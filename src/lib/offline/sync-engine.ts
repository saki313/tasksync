"use client";

/**
 * Moteur de synchronisation automatique multi-appareils.
 *
 * Cycle : PUSH (outbox → serveur) puis PULL (journal → IndexedDB).
 * - Déclencheurs : démarrage, retour réseau, retour sur l'application,
 *   intervalle régulier, modification locale (débouncée).
 * - Échecs réseau : tentatives automatiques avec backoff exponentiel ;
 *   les opérations restent dans la file (jamais perdues).
 * - Conflits : dernier-écrit-gagnant sur l'horodatage de l'opération ;
 *   le perdant reçoit l'état serveur (jamais d'écrasement silencieux).
 * - Sécurité : la session reste dans le cookie httpOnly ; rien de secret
 *   n'est stocké dans IndexedDB (seulement userId de display + curseur).
 */

import {
  db,
  getMeta,
  setMeta,
  clearLocalData,
  type LocalList,
  type LocalPhase,
  type LocalTask,
  type LocalUser,
  type OutboxEntry,
} from "./db";

export { countPendingOps } from "./db";
import type { EntityType } from "@/lib/sync-server";

export interface SyncState {
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  conflictCount: number;
  /** false = le serveur a répondu 401 (session expirée). */
  authorized: boolean;
}

const BACKOFF_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];
const PUSH_BATCH = 100;
const PULL_MAX_ROUNDS = 50;
const AUTO_INTERVAL_MS = 15_000;
const DEBOUNCE_MS = 1_500;

let state: SyncState = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  syncing: false,
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: null,
  lastError: null,
  conflictCount: 0,
  authorized: true,
};

const listeners = new Set<() => void>();
let cycleRunning = false;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;
let backoffAttempts = 0;
let autoTimer: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let onAuthLost: (() => void) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  emit();
}

export function getSyncState(): SyncState {
  return state;
}

/** S'abonne aux changements d'état (useSyncExternalStore). */
export function subscribeSyncState(listener: () => void): () => void {
  listeners.add(listener);
  listener();
  return () => listeners.delete(listener);
}

export function setAuthLostHandler(fn: (() => void) | null) {
  onAuthLost = fn;
}

async function refreshCounts() {
  const [pending, failed] = await Promise.all([
    db.outbox.filter((e) => !e.permanentError).count(),
    db.outbox.filter((e) => e.permanentError).count(),
  ]);
  setState({ pendingCount: pending, failedCount: failed });
}

/* ------------------------------ Démarrage -------------------------------- */

/** Initialise le moteur pour un utilisateur (changement de compte → reset local). */
export async function initEngine(user: {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}) {
  const storedId = await getMeta<string>("userId");
  if (storedId !== user.id) {
    // Autre compte sur cet appareil : on repart d'une base vide puis d'un
    // snapshot complet (isolation stricte entre utilisateurs).
    await clearLocalData();
    await setMeta("userId", user.id);
    await setMeta("cursor", "0");
  }
  await setMeta("user", user satisfies LocalUser);
  // Nouvelle session : on repart d'indicateurs vierges.
  setState({
    authorized: true,
    lastError: null,
    lastSyncAt: null,
    conflictCount: 0,
    online: navigator.onLine,
  });
  await refreshCounts();
  void requestSync(0);
}

export function startEngine() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  document.addEventListener("visibilitychange", handleVisibility);
  autoTimer = setInterval(() => void requestSync(0), AUTO_INTERVAL_MS);
}

export function stopEngine() {
  if (!started) return;
  started = false;
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  document.removeEventListener("visibilitychange", handleVisibility);
  if (autoTimer) clearInterval(autoTimer);
  if (backoffTimer) clearTimeout(backoffTimer);
  if (debounceTimer) clearTimeout(debounceTimer);
  autoTimer = backoffTimer = debounceTimer = null;
}

function handleOnline() {
  setState({ online: true });
  backoffAttempts = 0;
  void requestSync(0);
}

function handleOffline() {
  setState({ online: false });
}

function handleVisibility() {
  if (document.visibilityState === "visible") void requestSync(0);
}

/** Demande un cycle (débouncé : les rafales d'éditions ne créent pas de tempête). */
export function requestSync(debounceMs: number = DEBOUNCE_MS) {
  if (typeof window === "undefined") return;
  if (backoffTimer) {
    clearTimeout(backoffTimer);
    backoffTimer = null;
  }
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void runCycle(), Math.max(0, debounceMs));
  unrefTimer(debounceTimer);
}

/** Sous Node (tests), empêche les temporisations de bloquer la fin du process. */
function unrefTimer(timer: unknown) {
  if (timer && typeof timer === "object" && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }
}

/* ------------------------------- Cycle ----------------------------------- */

async function runCycle() {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) {
    setState({ online: false });
    return;
  }
  if (cycleRunning) return;
  cycleRunning = true;
  setState({ syncing: true, online: true });
  try {
    await pushOutbox();
    await pullChanges();
    backoffAttempts = 0;
    setState({ syncing: false, lastError: null, lastSyncAt: new Date().toISOString() });
  } catch (err) {
    setState({
      syncing: false,
      lastError: err instanceof Error ? err.message : "Erreur de synchronisation",
    });
    scheduleBackoff();
  } finally {
    cycleRunning = false;
    await refreshCounts();
    // Des opérations peuvent avoir été ajoutées pendant le cycle.
    if (state.online && state.pendingCount > 0) requestSync(1_000);
  }
}

function scheduleBackoff() {
  if (typeof window === "undefined") return;
  const ms = BACKOFF_MS[Math.min(backoffAttempts, BACKOFF_MS.length - 1)];
  backoffAttempts += 1;
  if (backoffTimer) clearTimeout(backoffTimer);
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void runCycle();
  }, ms);
  unrefTimer(backoffTimer);
}

export async function syncNow(): Promise<void> {
  await runCycle();
}

/* -------------------------------- Push ----------------------------------- */

interface MutationResultDto {
  mutationId: string;
  status: "applied" | "duplicate" | "conflict" | "missing" | "invalid";
  error?: string;
  payload?: Record<string, unknown> | null;
}

function toMutation(e: OutboxEntry) {
  return {
    mutationId: e.mutationId,
    entityType: e.entityType,
    entityId: e.entityId,
    op: e.op,
    data: e.data,
    opAt: e.opAt,
    baseUpdatedAt: e.baseUpdatedAt,
  };
}

async function pushOutbox() {
  for (;;) {
    const entries = await db.outbox.orderBy("createdAt").toArray();
    const retryable = entries.filter((e) => !e.permanentError);
    if (!retryable.length) return;
    const batch = retryable.slice(0, PUSH_BATCH);

    const res = await fetch("/api/sync/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: batch.map(toMutation) }),
    });
    if (res.status === 401) {
      setState({ authorized: false, lastError: "Session expirée" });
      onAuthLost?.();
      throw new Error("Session expirée");
    }
    if (!res.ok) {
      throw new Error(`Serveur indisponible (${res.status})`);
    }
    const data = (await res.json()) as { results?: MutationResultDto[] };
    const results = data.results ?? [];

    for (const r of results) {
      const entry = batch.find((b) => b.mutationId === r.mutationId);
      if (!entry) continue;
      switch (r.status) {
        case "applied":
        case "duplicate":
          // L'état serveur (updatedAt/version) remplace la copie locale pour
          // servir de base aux prochains calculs de conflits.
          await db.outbox.delete(entry.mutationId);
          if (r.payload) await putLocalEntity(entry.entityType, r.payload);
          break;
        case "conflict":
          await db.outbox.delete(entry.mutationId);
          if (r.payload) await putLocalEntity(entry.entityType, r.payload);
          setState({ conflictCount: state.conflictCount + 1 });
          window.dispatchEvent(
            new CustomEvent("tasksync:conflict", {
              detail: { entityType: entry.entityType },
            })
          );
          break;
        case "invalid":
          // Erreur définitive : conservée et signalée, mais plus renvoyée.
          await db.outbox.update(entry.mutationId, {
            permanentError: true,
            lastError: r.error ?? "Mutation invalide",
          });
          break;
        default:
          // Échec transitoire : conservé pour une nouvelle tentative.
          await db.outbox.update(entry.mutationId, {
            attempts: entry.attempts + 1,
            lastError: r.error ?? "Erreur serveur",
          });
          break;
      }
    }
  }
}

/* -------------------------------- Pull ----------------------------------- */

interface ChangeDto {
  id: string;
  entityType: EntityType;
  entityId: string;
  op: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

async function pullChanges() {
  let cursor = (await getMeta<string>("cursor")) ?? "0";
  for (let round = 0; round < PULL_MAX_ROUNDS; round++) {
    const res = await fetch(`/api/sync/pull?cursor=${encodeURIComponent(cursor)}`);
    if (res.status === 401) {
      setState({ authorized: false, lastError: "Session expirée" });
      onAuthLost?.();
      throw new Error("Session expirée");
    }
    if (!res.ok) throw new Error(`Serveur indisponible (${res.status})`);
    const data = (await res.json()) as {
      cursor: string;
      changes: ChangeDto[];
      hasMore: boolean;
      resync: boolean;
    };
    if (data.resync) {
      await fetchSnapshot();
      return;
    }
    if (!data.changes.length) {
      if (data.cursor) await setMeta("cursor", data.cursor);
      return;
    }
    await applyServerChanges(data.changes);
    cursor = data.cursor;
    await setMeta("cursor", cursor);
    if (!data.hasMore) return;
  }
}

async function applyServerChanges(changes: ChangeDto[]) {
  const pending = new Set(
    (await db.outbox.toArray()).map((e) => `${e.entityType}:${e.entityId}`)
  );
  for (const change of changes) {
    const key = `${change.entityType}:${change.entityId}`;
    // Une entité avec des opérations locales en attente n'est pas écrasée :
    // le push suivant tranche via le serveur (LWW) et l'écho met à jour la base.
    if (pending.has(key)) continue;

    if (change.op === "delete") {
      await db.table(change.entityType === "list" ? "lists" : change.entityType === "phase" ? "phases" : "tasks").delete(change.entityId);
      // Cascades locales, en miroir du serveur :
      if (change.entityType === "list") {
        await db.tasks.where("listId").equals(change.entityId).delete();
      }
      if (change.entityType === "phase") {
        const affected = await db.tasks.where("phaseId").equals(change.entityId).toArray();
        await db.tasks.bulkPut(
          affected.map((t) => ({ ...t, phaseId: null }))
        );
      }
      continue;
    }
    if (change.payload) {
      await putLocalEntity(change.entityType, change.payload);
    }
  }
}

/* ------------------------------ Snapshot --------------------------------- */

export async function fetchSnapshot(): Promise<void> {
  const res = await fetch("/api/sync/snapshot");
  if (res.status === 401) {
    setState({ authorized: false, lastError: "Session expirée" });
    onAuthLost?.();
    throw new Error("Session expirée");
  }
  if (!res.ok) throw new Error(`Serveur indisponible (${res.status})`);
  const snap = (await res.json()) as {
    cursor: string;
    user: { id: string; email: string; name: string | null; image: string | null };
    lists: Record<string, unknown>[];
    tasks: Record<string, unknown>[];
    phases: Record<string, unknown>[];
  };

  await db.transaction("rw", db.lists, db.tasks, db.phases, db.meta, async () => {
    await db.lists.clear();
    await db.tasks.clear();
    await db.phases.clear();
    await db.lists.bulkPut(snap.lists.map(normalizeList));
    await db.tasks.bulkPut(snap.tasks.map(normalizeTask));
    await db.phases.bulkPut(snap.phases.map(normalizePhase));
    await setMeta("cursor", snap.cursor);
    await setMeta("user", snap.user satisfies LocalUser);
  });
  await refreshCounts();
}

/* ------------------------- Normalisation locale --------------------------- */

function str(v: unknown): string | null {
  return typeof v === "string" ? v : v == null ? null : String(v);
}

function normalizeList(p: Record<string, unknown>): LocalList {
  return {
    id: String(p.id),
    name: str(p.name) ?? "Sans nom",
    color: str(p.color) ?? "#10b981",
    icon: str(p.icon) ?? "list",
    order: Number(p.order ?? 0),
    userId: str(p.userId) ?? "",
    createdAt: str(p.createdAt) ?? new Date().toISOString(),
    updatedAt: str(p.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizeTask(p: Record<string, unknown>): LocalTask {
  return {
    id: String(p.id),
    title: str(p.title) ?? "",
    notes: str(p.notes),
    completed: !!p.completed,
    completedAt: str(p.completedAt),
    priority: Number(p.priority ?? 1),
    dueDate: str(p.dueDate),
    starred: !!p.starred,
    listId: str(p.listId),
    phaseId: str(p.phaseId),
    userId: str(p.userId) ?? "",
    version: Number(p.version ?? 1),
    createdAt: str(p.createdAt) ?? new Date().toISOString(),
    updatedAt: str(p.updatedAt) ?? new Date().toISOString(),
  };
}

function normalizePhase(p: Record<string, unknown>): LocalPhase {
  return {
    id: String(p.id),
    title: str(p.title) ?? "",
    description: str(p.description),
    position: Number(p.position ?? 0),
    userId: str(p.userId) ?? "",
    createdAt: str(p.createdAt) ?? new Date().toISOString(),
    updatedAt: str(p.updatedAt) ?? new Date().toISOString(),
  };
}

async function putLocalEntity(
  entityType: EntityType,
  payload: Record<string, unknown>
) {
  if (entityType === "list") await db.lists.put(normalizeList(payload));
  else if (entityType === "phase") await db.phases.put(normalizePhase(payload));
  else await db.tasks.put(normalizeTask(payload));
}
