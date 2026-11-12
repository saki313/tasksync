import { getToken } from "next-auth/jwt";
import { AUTH_SECRET } from "@/lib/auth";
import type { NextRequest } from "next/server";

// Lecture de session indépendante de getServerSession : le JWT
// est décodé avec le MÊME secret (AUTH_SECRET) que celui utilisé
// pour la connexion, quel que soit le build ou l'environnement.
export async function requireUserId(req: NextRequest): Promise<string | null> {
  try {
    const token = await getToken({ req, secret: AUTH_SECRET });
    const id = (token?.id as string | undefined) ?? token?.sub;
    return id ?? null;
  } catch {
    return null;
  }
}
