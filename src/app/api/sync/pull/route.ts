import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/api-auth";
import type { EntityType } from "@/lib/sync-server";

const PAGE_SIZE = 500;

interface ChangeDto {
  id: string;
  entityType: EntityType;
  entityId: string;
  op: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * GET /api/sync/pull?cursor=<id du dernier changement vu>
 * Renvoie les changements suivants du journal de l'utilisateur.
 * Si le curseur est absent/invalide, `resync: true` (le client doit
 * faire un /api/sync/snapshot complet).
 */
export async function GET(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("cursor") ?? "";
  let cursor = 0;
  if (raw) {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return NextResponse.json({ cursor: "0", changes: [], resync: true });
    }
    cursor = parsed;
  }
  if (cursor === 0 && raw !== "0") {
    // Pas de curseur exploitable : resynchronisation complète demandée.
    return NextResponse.json({ cursor: "0", changes: [], resync: true });
  }

  const rows = await db.change.findMany({
    where: { userId, id: { gt: cursor } },
    orderBy: { id: "asc" },
    take: PAGE_SIZE,
  });

  const changes: ChangeDto[] = rows.map((c) => ({
    id: c.id.toString(),
    entityType: c.entityType as EntityType,
    entityId: c.entityId,
    op: c.op,
    payload: c.payload ? (JSON.parse(c.payload) as Record<string, unknown>) : null,
    createdAt: c.createdAt.toISOString(),
  }));

  const last = rows.length ? rows[rows.length - 1].id.toString() : raw || "0";
  return NextResponse.json({
    cursor: last,
    changes,
    hasMore: rows.length === PAGE_SIZE,
    resync: false,
  });
}
