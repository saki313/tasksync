import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const lists = await db.list.findMany({
    where: { userId },
    include: { _count: { select: { tasks: { where: { completed: false } } } } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(lists);
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  }

  const count = await db.list.count({ where: { userId } });
  const list = await db.list.create({
    data: {
      name: body.name.trim().slice(0, 60),
      color: typeof body.color === "string" ? body.color.slice(0, 9) : "#10b981",
      icon: typeof body.icon === "string" ? body.icon.slice(0, 30) : "list",
      order: count,
      userId,
    },
  });
  return NextResponse.json(list, { status: 201 });
}
