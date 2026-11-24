/**
 * Couche de stockage local (IndexedDB via Dexie).
 *
 * Source de vérité locale de l'application : toutes les lectures et écritures
 * passent ici, hors connexion comme en ligne. Le serveur est rejoint par le
 * moteur de synchronisation uniquement.
 *
 * Sécurité : aucun secret ni jeton n'est stocké ici — seulement les données
 * métier, l'identifiant d'utilisateur (affichage/isolation) et le curseur.
 */

import Dexie, { type EntityTable } from "dexie";
import type { EntityType, OpType } from "@/lib/sync-server";

export interface LocalList {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalTask {
  id: string;
  title: string;
  notes: string | null;
  completed: boolean;
  completedAt: string | null;
  priority: number;
  dueDate: string | null;
  starred: boolean;
  listId: string | null;
  phaseId: string | null;
  userId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalPhase {
  id: string;
  title: string;
  description: string | null;
  position: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/** Opération locale en attente d'envoi au serveur (Outbox Pattern). */
export interface OutboxEntry {
  mutationId: string;
  entityType: EntityType;
  entityId: string;
  op: OpType;
  /** État complet des champs métier pour create/update ; null pour delete. */
  data: Record<string, unknown> | null;
  /** Horodatage local de l'opération (décide des conflits, LWW). */
  opAt: string;
  /** updatedAt connu du client avant l'édition (détection de conflit). */
  baseUpdatedAt: string | null;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  /** Erreur définitive (validation/permission) : ne sera plus renvoyée. */
  permanentError: boolean;
}

export interface LocalUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface MetaEntry {
  key: string;
  value: unknown;
}

export const db = new Dexie("tasksync") as Dexie & {
  lists: EntityTable<LocalList, "id">;
  tasks: EntityTable<LocalTask, "id">;
  phases: EntityTable<LocalPhase, "id">;
  outbox: EntityTable<OutboxEntry, "mutationId">;
  meta: EntityTable<MetaEntry, "key">;
};

db.version(1).stores({
  lists: "id, userId, order",
  tasks: "id, userId, listId, phaseId, completed, starred, dueDate",
  phases: "id, userId, position",
  outbox: "mutationId, createdAt",
  meta: "key",
});

/* ------------------------------- Métadonnées ------------------------------ */

export async function getMeta<T>(key: string): Promise<T | null> {
  const entry = await db.meta.get(key);
  return entry ? (entry.value as T) : null;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function getLocalUser(): Promise<LocalUser | null> {
  return getMeta<LocalUser>("user");
}

export async function countPendingOps(): Promise<number> {
  return db.outbox.filter((e) => !e.permanentError).count();
}

/** Efface TOUTES les données locales (déconnexion, changement de compte). */
export async function clearLocalData(): Promise<void> {
  await db.transaction(
    "rw",
    db.lists,
    db.tasks,
    db.phases,
    db.outbox,
    db.meta,
    async () => {
      await Promise.all([
        db.lists.clear(),
        db.tasks.clear(),
        db.phases.clear(),
        db.outbox.clear(),
        db.meta.clear(),
      ]);
    }
  );
}

/* --------------------------------- Outbox -------------------------------- */

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}-${Math.random().toString(16).slice(2)}`;
}

export interface EnqueueInput {
  entityType: EntityType;
  entityId: string;
  op: OpType;
  data: Record<string, unknown> | null;
  baseUpdatedAt: string | null;
}

/**
 * Enregistre une opération locale dans la file d'attente. Appelée APRÈS
 * l'écriture locale réussie : une indisponibilité du serveur ne bloque
 * jamais une opération locale.
 */
export async function enqueueOperation(input: EnqueueInput): Promise<string> {
  const mutationId = uuid();
  const now = new Date().toISOString();
  await db.outbox.add({
    mutationId,
    entityType: input.entityType,
    entityId: input.entityId,
    op: input.op,
    data: input.data,
    opAt: now,
    baseUpdatedAt: input.baseUpdatedAt,
    createdAt: now,
    attempts: 0,
    lastError: null,
    permanentError: false,
  });
  return mutationId;
}

/** Retarde l'exécution de `ms` millisecondes (backoff du moteur de sync). */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { uuid as newId };
