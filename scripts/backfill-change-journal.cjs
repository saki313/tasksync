/**
 * Répare le journal de synchronisation pour les entités créées avant
 * l'existence de la table `Change` : une entrée `create` est ajoutée pour
 * chaque liste / tâche / phase qui n'a encore aucun changement journalisé.
 *
 * Usage :
 *   set -a; . ./.env; set +a
 *   node scripts/backfill-change-journal.cjs
 */
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

function serializeList(l) {
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

function serializeTask(t) {
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

function serializePhase(p) {
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

const types = [
  { entityType: "list", delegate: db.list, serialize: serializeList },
  { entityType: "task", delegate: db.task, serialize: serializeTask },
  { entityType: "phase", delegate: db.phase, serialize: serializePhase },
];

async function main() {
  const users = await db.user.findMany({ select: { id: true } });
  let total = 0;

  for (const user of users) {
    for (const { entityType, delegate, serialize } of types) {
      const [entities, logged] = await Promise.all([
        delegate.findMany({ where: { userId: user.id } }),
        db.change.findMany({
          where: { userId: user.id, entityType },
          select: { entityId: true },
        }),
      ]);
      const already = new Set(logged.map((c) => c.entityId));
      const missing = entities.filter((e) => !already.has(e.id));

      for (const entity of missing) {
        await db.change.create({
          data: {
            userId: user.id,
            entityType,
            entityId: entity.id,
            op: "create",
            payload: JSON.stringify(serialize(entity)),
            mutationId: null,
          },
        });
      }
      if (missing.length) {
        console.log(`${user.id} ${entityType}: ${missing.length} entrée(s) ajoutée(s)`);
        total += missing.length;
      }
    }
  }

  console.log(`Total ajouté : ${total}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
