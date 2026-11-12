import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const existing = await db.task.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  if (body.listId) {
    const list = await db.list.findFirst({ where: { id: body.listId, userId } });
    if (!list) return NextResponse.json({ error: "Liste introuvable" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 500);
  if (body.notes !== undefined) data.notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 5000) : null;
  if (body.priority !== undefined) data.priority = Math.min(2, Math.max(0, Math.round(Number(body.priority) || 0)));
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.starred !== undefined) data.starred = !!body.starred;
  if (body.listId !== undefined) data.listId = body.listId || null;
  if (body.completed !== undefined) {
    data.completed = !!body.completed;
    data.completedAt = body.completed ? new Date() : null;
  }

  const task = await db.task.update({
    where: { id },
    data,
    include: { list: { select: { id: true, name: true, color: true } } },
  });
  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId(_req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const existing = await db.task.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Tâche introuvable" }, { status: 404 });

  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
