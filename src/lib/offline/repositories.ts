"use client";

/**
 * Repositories locaux — toutes les opérations métier passent ici.
 *
 * Chaque opération est écrite dans IndexedDB PUIS placée dans la file
 * d'attente (Outbox) : une indisponibilité du serveur ne bloque jamais
 * l'écriture locale. Le moteur de synchronisation est notifié après coup.
 */

import {
  db,
  enqueueOperation,
  getMeta,
  newId,
  type LocalList,
  type LocalPhase,
  type LocalTask,
  type LocalUser,
} from "./db";
import { requestSync } from "./sync-engine";
import type { ListDto, PhaseDto, TaskDto, TaskListRef, TaskPhaseRef } from "@/lib/types";

/* ------------------------------ Conversions ------------------------------- */

function toListDto(l: LocalList, taskCount: number): ListDto {
  return {
    id: l.id,
    name: l.name,
    color: l.color,
    icon: l.icon,
    order: l.order,
    _count: { tasks: taskCount },
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

function toPhaseDto(p: LocalPhase): PhaseDto {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    position: p.position,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function toTaskDto(
  t: LocalTask,
  lists: LocalList[],
  phases: LocalPhase[]
): TaskDto {
  const list = t.listId
    ? (lists.find((l) => l.id === t.listId) ?? null)
    : null;
  const phase = t.phaseId
    ? (phases.find((p) => p.id === t.phaseId) ?? null)
    : null;
  const listRef: TaskListRef | null = list
    ? { id: list.id, name: list.name, color: list.color }
    : null;
  const phaseRef: TaskPhaseRef | null = phase
    ? { id: phase.id, title: phase.title }
    : null;
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    completed: t.completed,
    completedAt: t.completedAt,
    priority: t.priority,
    dueDate: t.dueDate,
    starred: t.starred,
    listId: t.listId,
    list: listRef,
    phaseId: t.phaseId,
    phase: phaseRef,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function clampPriority(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : 1;
}

async function currentUserId(): Promise<string> {
  const user = await getMeta<LocalUser>("user");
  return user?.id ?? "local";
}

/** Champs métier envoyés au serveur (le userId vient de la session). */
function taskFields(t: LocalTask): Record<string, unknown> {
  return {
    title: t.title,
    notes: t.notes,
    completed: t.completed,
    completedAt: t.completedAt,
    priority: t.priority,
    dueDate: t.dueDate,
    starred: t.starred,
    listId: t.listId,
    phaseId: t.phaseId,
  };
}

function listFields(l: LocalList): Record<string, unknown> {
  return { name: l.name, color: l.color, icon: l.icon, order: l.order };
}

function phaseFields(p: LocalPhase): Record<string, unknown> {
  return { title: p.title, description: p.description, position: p.position };
}

/* ------------------------------- Lecture ---------------------------------- */

export async function getAllLists(): Promise<ListDto[]> {
  const [lists, tasks] = await Promise.all([db.lists.toArray(), db.tasks.toArray()]);
  return lists
    .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
    .map((l) =>
      toListDto(
        l,
        tasks.filter((t) => t.listId === l.id && !t.completed).length
      )
    );
}

export async function getAllTasks(): Promise<TaskDto[]> {
  const [tasks, lists, phases] = await Promise.all([
    db.tasks.toArray(),
    db.lists.toArray(),
    db.phases.toArray(),
  ]);
  return tasks
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => toTaskDto(t, lists, phases));
}

export async function getAllPhases(): Promise<PhaseDto[]> {
  const phases = await db.phases.toArray();
  return phases
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
    .map(toPhaseDto);
}

/* ------------------------------- Tâches ----------------------------------- */

export interface TaskRepoInput {
  title: string;
  notes?: string | null;
  priority?: number;
  dueDate?: string | null;
  starred?: boolean;
  listId?: string | null;
  phaseId?: string | null;
}

export type TaskRepoUpdate = Partial<
  TaskRepoInput & { completed: boolean; completedAt?: string | null }
>;

export async function createTask(input: TaskRepoInput): Promise<TaskDto> {
  const now = new Date().toISOString();
  const userId = await currentUserId();
  const task: LocalTask = {
    id: newId(),
    title: input.title.trim().slice(0, 500) || "Tâche",
    notes:
      typeof input.notes === "string" && input.notes.trim()
        ? input.notes.trim().slice(0, 5000)
        : null,
    completed: false,
    completedAt: null,
    priority: clampPriority(input.priority ?? 1),
    dueDate: input.dueDate ?? null,
    starred: !!input.starred,
    listId: input.listId ?? null,
    phaseId: input.phaseId ?? null,
    userId,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  // 1) écriture locale — source de vérité immédiate, même hors connexion
  await db.tasks.add(task);
  // 2) file d'attente puis notification du moteur (jamais bloquant)
  await enqueueOperation({
    entityType: "task",
    entityId: task.id,
    op: "create",
    data: taskFields(task),
    baseUpdatedAt: null,
  });
  requestSync();
  const [lists, phases] = await Promise.all([db.lists.toArray(), db.phases.toArray()]);
  return toTaskDto(task, lists, phases);
}

export async function updateTask(
  id: string,
  data: TaskRepoUpdate
): Promise<TaskDto> {
  const existing = await db.tasks.get(id);
  if (!existing) throw new Error("Tâche introuvable");
  const baseUpdatedAt = existing.updatedAt;
  const next: LocalTask = { ...existing };

  if (data.title !== undefined) {
    const title = data.title.trim().slice(0, 500);
    if (title) next.title = title;
  }
  if (data.notes !== undefined) {
    next.notes =
      typeof data.notes === "string" && data.notes.trim()
        ? data.notes.trim().slice(0, 5000)
        : null;
  }
  if (data.priority !== undefined) next.priority = clampPriority(data.priority);
  if (data.dueDate !== undefined) next.dueDate = data.dueDate;
  if (data.starred !== undefined) next.starred = !!data.starred;
  if (data.listId !== undefined) next.listId = data.listId;
  if (data.phaseId !== undefined) next.phaseId = data.phaseId;
  if (data.completed !== undefined) {
    next.completed = !!data.completed;
    next.completedAt = data.completed
      ? (data.completedAt ?? existing.completedAt ?? new Date().toISOString())
      : null;
  }
  next.updatedAt = new Date().toISOString();
  next.version = existing.version + 1;

  await db.tasks.put(next);
  await enqueueOperation({
    entityType: "task",
    entityId: id,
    op: "update",
    data: taskFields(next),
    baseUpdatedAt,
  });
  requestSync();
  const [lists, phases] = await Promise.all([db.lists.toArray(), db.phases.toArray()]);
  return toTaskDto(next, lists, phases);
}

export async function deleteTask(id: string): Promise<void> {
  const existing = await db.tasks.get(id);
  await db.tasks.delete(id);
  if (existing) {
    await enqueueOperation({
      entityType: "task",
      entityId: id,
      op: "delete",
      data: null,
      baseUpdatedAt: existing.updatedAt,
    });
  }
  requestSync();
}

/* ------------------------------- Listes ----------------------------------- */

export interface ListRepoInput {
  name: string;
  color?: string;
}

export async function createList(input: ListRepoInput): Promise<ListDto> {
  const now = new Date().toISOString();
  const userId = await currentUserId();
  const order = await db.lists.count();
  const list: LocalList = {
    id: newId(),
    name: input.name.trim().slice(0, 60) || "Nouvelle liste",
    color: input.color?.slice(0, 9) ?? "#10b981",
    icon: "list",
    order,
    userId,
    createdAt: now,
    updatedAt: now,
  };
  await db.lists.add(list);
  await enqueueOperation({
    entityType: "list",
    entityId: list.id,
    op: "create",
    data: listFields(list),
    baseUpdatedAt: null,
  });
  requestSync();
  return toListDto(list, 0);
}

export async function updateList(
  id: string,
  data: Partial<ListRepoInput>
): Promise<ListDto> {
  const existing = await db.lists.get(id);
  if (!existing) throw new Error("Liste introuvable");
  const baseUpdatedAt = existing.updatedAt;
  const next: LocalList = { ...existing };
  if (data.name !== undefined) {
    const name = data.name.trim().slice(0, 60);
    if (name) next.name = name;
  }
  if (data.color !== undefined) next.color = data.color.slice(0, 9);
  next.updatedAt = new Date().toISOString();

  await db.lists.put(next);
  await enqueueOperation({
    entityType: "list",
    entityId: id,
    op: "update",
    data: listFields(next),
    baseUpdatedAt,
  });
  requestSync();
  const taskCount = await db.tasks.where("listId").equals(id).count();
  return toListDto(next, taskCount);
}

/** Supprime une liste et ses tâches en local ; le serveur journalise la
 *  cascade pour les autres appareils. */
export async function deleteList(id: string): Promise<void> {
  const existing = await db.lists.get(id);
  await db.transaction("rw", db.lists, db.tasks, async () => {
    await db.lists.delete(id);
    await db.tasks.where("listId").equals(id).delete();
  });
  if (existing) {
    await enqueueOperation({
      entityType: "list",
      entityId: id,
      op: "delete",
      data: null,
      baseUpdatedAt: existing.updatedAt,
    });
  }
  requestSync();
}

/* ------------------------------- Phases ----------------------------------- */

export interface PhaseRepoInput {
  title: string;
  description?: string | null;
}

export async function createPhase(input: PhaseRepoInput): Promise<PhaseDto> {
  const now = new Date().toISOString();
  const userId = await currentUserId();
  const position = await db.phases.count();
  const phase: LocalPhase = {
    id: newId(),
    title: input.title.trim().slice(0, 120) || "Nouvelle phase",
    description:
      typeof input.description === "string" && input.description.trim()
        ? input.description.trim().slice(0, 500)
        : null,
    position,
    userId,
    createdAt: now,
    updatedAt: now,
  };
  await db.phases.add(phase);
  await enqueueOperation({
    entityType: "phase",
    entityId: phase.id,
    op: "create",
    data: phaseFields(phase),
    baseUpdatedAt: null,
  });
  requestSync();
  return toPhaseDto(phase);
}

export async function updatePhase(
  id: string,
  data: Partial<PhaseRepoInput>
): Promise<PhaseDto> {
  const existing = await db.phases.get(id);
  if (!existing) throw new Error("Phase introuvable");
  const baseUpdatedAt = existing.updatedAt;
  const next: LocalPhase = { ...existing };
  if (data.title !== undefined) {
    const title = data.title.trim().slice(0, 120);
    if (title) next.title = title;
  }
  if (data.description !== undefined) {
    next.description =
      typeof data.description === "string" && data.description.trim()
        ? data.description.trim().slice(0, 500)
        : null;
  }
  next.updatedAt = new Date().toISOString();

  await db.phases.put(next);
  await enqueueOperation({
    entityType: "phase",
    entityId: id,
    op: "update",
    data: phaseFields(next),
    baseUpdatedAt,
  });
  requestSync();
  return toPhaseDto(next);
}

/** Supprime une phase : les tâches rattachées ne sont PAS supprimées,
 *  elles perdent seulement leur phase (comme côté serveur). */
export async function deletePhase(id: string): Promise<void> {
  const existing = await db.phases.get(id);
  const affected = await db.tasks.where("phaseId").equals(id).toArray();
  await db.transaction("rw", db.phases, db.tasks, async () => {
    await db.phases.delete(id);
    await db.tasks.bulkPut(affected.map((t) => ({ ...t, phaseId: null })));
  });
  if (existing) {
    await enqueueOperation({
      entityType: "phase",
      entityId: id,
      op: "delete",
      data: null,
      baseUpdatedAt: existing.updatedAt,
    });
  }
  requestSync();
}

/** Réordonne les phases : `orderedIds` liste complète dans le nouvel ordre. */
export async function reorderPhases(orderedIds: string[]): Promise<void> {
  const phases = await db.phases.toArray();
  const byId = new Map(phases.map((p) => [p.id, p]));
  const moves: Array<{
    phase: LocalPhase;
    position: number;
    previousUpdatedAt: string;
  }> = [];
  orderedIds.forEach((id, index) => {
    const phase = byId.get(id);
    if (phase && phase.position !== index) {
      moves.push({
        previousUpdatedAt: phase.updatedAt,
        phase: { ...phase, position: index, updatedAt: new Date().toISOString() },
        position: index,
      });
    }
  });
  if (!moves.length) return;

  await db.phases.bulkPut(moves.map((m) => m.phase));
  for (const m of moves) {
    await enqueueOperation({
      entityType: "phase",
      entityId: m.phase.id,
      op: "update",
      data: phaseFields(m.phase),
      baseUpdatedAt: m.previousUpdatedAt,
    });
  }
  requestSync();
}

/** Déplace une tâche vers une phase (ou hors phase avec null). */
export async function moveTaskToPhase(
  taskId: string,
  phaseId: string | null
): Promise<void> {
  await updateTask(taskId, { phaseId });
}
