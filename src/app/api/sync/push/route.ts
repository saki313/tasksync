import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/api-auth";
import { applyMutation, type MutationResult, type SyncMutation } from "@/lib/sync-server";

const MAX_BATCH = 200;

/**
 * POST /api/sync/push
 * Corps : { mutations: SyncMutation[] } — lot de mutations locales (Outbox).
 * Toutes les mutations sont appliquées dans UNE transaction Prisma.
 * Le userId vient de la session, jamais du corps de la requête.
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { mutations?: SyncMutation[] }
    | null;
  if (!body || !Array.isArray(body.mutations)) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (body.mutations.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Lot trop volumineux (${body.mutations.length} > ${MAX_BATCH})` },
      { status: 400 }
    );
  }

  let results: MutationResult[];
  try {
    results = await db.$transaction(
      async (tx) => {
        const out: MutationResult[] = [];
        for (const mutation of body.mutations as SyncMutation[]) {
          // Une mutation invalide n'annule pas le lot : elle est signalée
          // individuellement ; seul un échec de base de données annule tout
          // (rollback transactionnel, le client retentera).
          try {
            out.push(await applyMutation(tx, userId, mutation));
          } catch (err) {
            out.push({
              mutationId:
                typeof mutation?.mutationId === "string"
                  ? mutation.mutationId
                  : "inconnu",
              status: "invalid",
              error: err instanceof Error ? err.message : "Erreur inconnue",
            });
          }
        }
        return out;
      },
      { timeout: 20_000 }
    );
  } catch (err) {
    console.error("sync push: transaction failed", err);
    return NextResponse.json(
      { error: "Transaction échouée, réessayez" },
      { status: 500 }
    );
  }

  return NextResponse.json({ results });
}
