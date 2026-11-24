import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/api-auth";
import { serializeList, serializePhase, serializeTask } from "@/lib/sync-server";

/**
 * GET /api/sync/snapshot
 * État complet du compte + curseur courant. Utilisé à la première
 * synchronisation, après un changement de compte ou quand le curseur
 * local est trop ancien. Remplace les données locales de l'appareil.
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [user, lists, tasks, phases, maxChange] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, image: true },
    }),
    db.list.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    db.task.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.phase.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    db.change.aggregate({ where: { userId }, _max: { id: true } }),
  ]);

  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  return NextResponse.json({
    cursor: maxChange._max.id ? maxChange._max.id.toString() : "0",
    user,
    lists: lists.map(serializeList),
    tasks: tasks.map(serializeTask),
    phases: phases.map(serializePhase),
  });
}
