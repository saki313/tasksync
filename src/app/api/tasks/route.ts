import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tasks = await db.task.findMany({
    where: { userId },
    include: { list: { select: { id: true, name: true, color: true } } },
    orderBy: [{ createdAt: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }

  // Verify list ownership if provided
  if (body.listId) {
    const list = await db.list.findFirst({ where: { id: body.listId, userId } });
    if (!list) return NextResponse.json({ error: "Liste introuvable" }, { status: 400 });
  }

  const task = await db.task.create({
    data: {
      title: body.title.trim().slice(0, 500),
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 5000) : null,
      priority: Number.isFinite(body.priority) ? Math.min(2, Math.max(0, Math.round(body.priority))) : 1,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      starred: !!body.starred,
      listId: body.listId || null,
      userId,
    },
    include: { list: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(task, { status: 201 });
}
