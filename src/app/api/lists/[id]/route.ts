import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const existing = await db.list.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Liste introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 60);
  if (typeof body.color === "string") data.color = body.color.slice(0, 9);
  if (typeof body.icon === "string") data.icon = body.icon.slice(0, 30);
  if (body.order !== undefined) data.order = Math.round(Number(body.order) || 0);

  const list = await db.list.update({ where: { id }, data });
  return NextResponse.json(list);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId(_req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const existing = await db.list.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Liste introuvable" }, { status: 404 });

  await db.list.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
