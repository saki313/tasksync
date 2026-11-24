import { Prisma } from "@prisma/client";
import type { List, Phase, Task } from "@prisma/client";

/**
 * Moteur de synchronisation côté serveur.
 *
 * Chaque mutation client (Outbox) est appliquée dans une transaction Prisma,
 * est idempotente (mutationId unique par utilisateur) et journalisée dans
 * `Change` avec l'état complet de l'entité après application (curseur de sync).
 *
 * Isolation : toutes les requêtes filtrent par le userId de la SESSION,
 * jamais par un userId transmis par le client.
 */

export type EntityType = "list" | "task" | "phase";
export type OpType = "create" | "update" | "delete";

export interface SyncMutation {
  mutationId: string;
  entityType: EntityType;
  entityId: string;
  op: OpType;
  /** Champs à écrire (état complet de l'entité pour create/update). */
  data?: Record<string, unknown> | null;
  /** Horodatage local de l'opération (horloge du client qui a édité). */
  opAt?: string | null;
  /** updatedAt de l'entité tel que connu par le client avant son édition. */
  baseUpdatedAt?: string | null;
}

export type MutationStatus =
  | "applied"
  | "duplicate"
  | "conflict"
  | "missing"
  | "invalid";

export interface MutationResult {
  mutationId: string;
  status: MutationStatus;
  error?: string;
  /** État serveur de l'entité (conflit, ou après application). */
  payload?: Record<string, unknown> | null;
}

/* ----------------------------- Sérialisation ----------------------------- */

export function serializeList(l: List): Record<string, unknown> {
  return {
    id: l.id,
    name: l.name,
    color: l.color,
    icon: l.icon,
    order: l.order,
    userId: l.userId,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export function serializeTask(t: Task): Record<string, unknown> {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    completed: t.completed,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    starred: t.starred,
    listId: t.listId,
    phaseId: t.phaseId,
    userId: t.userId,
    version: t.version,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializePhase(p: Phase): Record<string, unknown> {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    position: p.position,
    userId: p.userId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeEntity(
  entityType: EntityType,
  entity: List | Task | Phase
): Record<string, unknown> {
  if (entityType === "list") return serializeList(entity as List);
  if (entityType === "phase") return serializePhase(entity as Phase);
  return serializeTask(entity as Task);
}

/* --------------------------- Validations métier -------------------------- */

function str(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

function dateOrNull(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function clampPriority(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : 1;
}

function clampInt(v: unknown, fallback = 0): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
}

type PrismaTx = Prisma.TransactionClient;

/** Nettoie et valide les champs d'une mutation. Renvoie null si invalide. */
async function sanitizeFields(
  tx: PrismaTx,
  userId: string,
  entityType: EntityType,
  raw: Record<string, unknown> | null | undefined,
  op: OpType
): Promise<Record<string, unknown> | null> {
  const data: Record<string, unknown> = {};
  const src = raw ?? {};

  if (entityType === "list") {
    if (op === "create") {
      const name = str(src.name, 60);
      if (!name) return null;
      data.name = name;
    } else if (src.name !== undefined) {
      const name = str(src.name, 60);
      if (!name) return null;
      data.name = name;
    }
    if (typeof src.color === "string") data.color = src.color.slice(0, 9);
    if (typeof src.icon === "string") data.icon = src.icon.slice(0, 30);
    if (src.order !== undefined) data.order = clampInt(src.order);
    return data;
  }

  if (entityType === "phase") {
    if (src.title !== undefined || op === "create") {
      const title = str(src.title, 120);
      if (!title) return null;
      data.title = title;
    }
    if (src.description !== undefined) {
      data.description = str(src.description, 500);
    }
    if (src.position !== undefined) data.position = clampInt(src.position);
    return data;
  }

  // task
  if (src.title !== undefined || op === "create") {
    const title = str(src.title, 500);
    if (!title) return null;
    data.title = title;
  }
  if (src.notes !== undefined) data.notes = str(src.notes, 5000);
  if (src.completed !== undefined) {
    data.completed = !!src.completed;
    data.completedAt = src.completed
      ? (dateOrNull(src.completedAt) ?? new Date())
      : null;
  } else if (src.completedAt !== undefined) {
    data.completedAt = dateOrNull(src.completedAt);
  }
  if (src.priority !== undefined) data.priority = clampPriority(src.priority);
  if (src.dueDate !== undefined) data.dueDate = dateOrNull(src.dueDate);
  if (src.starred !== undefined) data.starred = !!src.starred;

  // Références : la liste et la phase doivent appartenir au même utilisateur.
  if (src.listId !== undefined) {
    const listId = typeof src.listId === "string" && src.listId ? src.listId : null;
    if (listId) {
      const owned = await tx.list.findFirst({ where: { id: listId, userId }, select: { id: true } });
      if (!owned) return null;
    }
    data.listId = listId;
  }
  if (src.phaseId !== undefined) {
    const phaseId = typeof src.phaseId === "string" && src.phaseId ? src.phaseId : null;
    if (phaseId) {
      const owned = await tx.phase.findFirst({ where: { id: phaseId, userId }, select: { id: true } });
      if (!owned) return null;
    }
    data.phaseId = phaseId;
  }
  return data;
}

/* ----------------------------- Application ------------------------------- */

function parseDate(v: unknown): Date | null {
  const d = dateOrNull(v);
  return d;
}

function opTime(m: SyncMutation): Date {
  const d = parseDate(m.opAt);
  return d ?? new Date(0);
}

function baseTime(m: SyncMutation): Date | null {
  return parseDate(m.baseUpdatedAt);
}

/**
 * Applique une mutation dans une transaction. Idempotent (mutationId),
 * propriétaire vérifié, conflits résolus en dernier-écrit-gagnant sur
 * l'horodatage de l'opération ; le perdant reçoit l'état serveur.
 */
export async function applyMutation(
  tx: PrismaTx,
  userId: string,
  m: SyncMutation
): Promise<MutationResult> {
  const done = (
    status: MutationStatus,
    payload?: Record<string, unknown> | null,
    error?: string
  ): MutationResult => ({ mutationId: m.mutationId, status, payload, error });

  if (
    !m || typeof m.mutationId !== "string" || !m.mutationId ||
    typeof m.entityId !== "string" || !m.entityId ||
    (m.op !== "create" && m.op !== "update" && m.op !== "delete") ||
    (m.entityType !== "list" && m.entityType !== "task" && m.entityType !== "phase")
  ) {
    return done("invalid", null, "Mutation mal formée");
  }

  // Idempotence : cette mutation a déjà été appliquée par le passé.
  const seen = await tx.change.findFirst({
    where: { userId, mutationId: m.mutationId },
    select: { id: true },
  });
  if (seen) {
    const entity = await findEntity(tx, userId, m.entityType, m.entityId);
    return done("duplicate", entity ? serializeEntity(m.entityType, entity) : null);
  }

  const entity = await findEntity(tx, userId, m.entityType, m.entityId);

  // Garde-fou d'isolation : l'identifiant existe chez un AUTRE utilisateur →
  // ni lecture, ni résurrection, ni écrasement possible par id.
  if (!entity) {
    const foreign = (await (tx[m.entityType] as unknown as {
      findUnique: (args: { where: { id: string } }) => Promise<List | Task | Phase | null>;
    }).findUnique({ where: { id: m.entityId } })) as List | Task | Phase | null;
    if (foreign) {
      return done("invalid", null, "Ressource appartenant à un autre utilisateur");
    }
  }

  if (m.op === "delete") {
    if (!entity) {
      // Déjà supprimée côté serveur (autre appareil) : rien à faire.
      await logChange(tx, userId, m, null);
      return done("applied", null);
    }
    // LWW : si une édition plus récente que la suppression a eu lieu sur un
    // autre appareil après la base connue du client, on refuse la suppression
    // et on renvoie l'état serveur (les éditions locales ne sont jamais
    // écrasées silencieusement).
    if (conflictDetected(m, entity.updatedAt)) {
      return done("conflict", serializeEntity(m.entityType, entity));
    }
    // Cascade miroir de la base, journalisée APRÈS application pour refléter
    // l'état final : suppression des tâches d'une liste, détachement des
    // tâches d'une phase (FK ON DELETE SET NULL).
    if (m.entityType === "list") {
      const taskRows = await tx.task.findMany({
        where: { listId: entity.id },
        select: { id: true },
      });
      await delegate(tx, m.entityType).delete({ where: { id: entity.id } });
      for (const t of taskRows) {
        await delegate(tx, "task").delete({ where: { id: t.id } });
        await tx.change.create({
          data: {
            userId,
            entityType: "task",
            entityId: t.id,
            op: "delete",
            payload: null,
            mutationId: null,
          },
        });
      }
    } else if (m.entityType === "phase") {
      const taskRows = await tx.task.findMany({
        where: { phaseId: entity.id },
        select: { id: true },
      });
      // La FK ON DELETE SET NULL détache les tâches à la suppression.
      await delegate(tx, m.entityType).delete({ where: { id: entity.id } });
      for (const t of taskRows) {
        const refreshed = await tx.task.findUnique({ where: { id: t.id } });
        if (refreshed) {
          await tx.change.create({
            data: {
              userId,
              entityType: "task",
              entityId: refreshed.id,
              op: "update",
              payload: JSON.stringify(serializeTask(refreshed)),
              mutationId: null,
            },
          });
        }
      }
    } else {
      await delegate(tx, m.entityType).delete({ where: { id: entity.id } });
    }
    await logChange(tx, userId, m, null);
    return done("applied", null);
  }

  const data = await sanitizeFields(tx, userId, m.entityType, m.data, m.op);
  if (!data) {
    return done("invalid", null, "Champs invalides");
  }

  if (!entity) {
    if (m.op === "update") {
      // L'entité a été supprimée sur un autre appareil pendant que celle-ci
      // était hors ligne : on ressuscite l'édition locale plutôt que de la
      // perdre (jamais d'écrasement silencieux des modifications locales).
      const created = await createEntity(tx, userId, m.entityType, m.entityId, data);
      await logChange(tx, userId, m, created);
      return done("applied", serializeEntity(m.entityType, created));
    }
    const created = await createEntity(tx, userId, m.entityType, m.entityId, data);
    await logChange(tx, userId, m, created);
    return done("applied", serializeEntity(m.entityType, created));
  }

  // L'entité existe déjà : create → fusion (upsert), update → LWW.
  if (conflictDetected(m, entity.updatedAt)) {
    return done("conflict", serializeEntity(m.entityType, entity));
  }
  const updateData =
    m.entityType === "task"
      ? { ...data, version: { increment: 1 } }
      : data;
  const updated = (await delegate(tx, m.entityType).update({
    where: { id: entity.id },
    data: updateData,
  })) as List | Task | Phase;
  await logChange(tx, userId, m, updated);
  return done("applied", serializeEntity(m.entityType, updated));
}

/** Détecte un vrai conflit concurrent : le serveur a changé l'entité après
 *  la base connue du client ET après l'horodatage de l'opération locale.
 *  Exporté pour les tests unitaires (règle LWW). */
export function conflictDetected(m: SyncMutation, serverUpdatedAt: Date): boolean {
  const opAt = opTime(m);
  if (serverUpdatedAt.getTime() <= opAt.getTime()) return false;
  const base = baseTime(m);
  if (!base) return true; // base inconnue : prudence, serveur plus récent
  return serverUpdatedAt.getTime() > base.getTime();
}

type EntityDelegate = {
  findFirst: (args: { where: Record<string, unknown> }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
  update: (args: Record<string, unknown>) => Promise<unknown>;
  create: (args: Record<string, unknown>) => Promise<unknown>;
};

function delegate(tx: PrismaTx, entityType: EntityType): EntityDelegate {
  return tx[entityType] as unknown as EntityDelegate;
}

async function findEntity(
  tx: PrismaTx,
  userId: string,
  entityType: EntityType,
  id: string
): Promise<List | Task | Phase | null> {
  const e = (await delegate(tx, entityType).findFirst({
    where: { id, userId },
  })) as List | Task | Phase | null;
  return e;
}

async function createEntity(
  tx: PrismaTx,
  userId: string,
  entityType: EntityType,
  id: string,
  data: Record<string, unknown>
): Promise<List | Task | Phase> {
  const created = (await delegate(tx, entityType).create({
    data: { id, ...data, userId },
  })) as List | Task | Phase;
  return created;
}

async function logChange(
  tx: PrismaTx,
  userId: string,
  m: SyncMutation,
  entity: List | Task | Phase | null
) {
  await tx.change.create({
    data: {
      userId,
      entityType: m.entityType,
      entityId: m.entityId,
      op: m.op,
      payload:
        entity === null || entity === undefined
          ? null
          : JSON.stringify(serializeEntity(m.entityType, entity)),
      mutationId: m.mutationId,
    },
  });
}
