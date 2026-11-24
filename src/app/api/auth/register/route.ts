import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/lib/auth";

// Codes d'erreur -> réponse HTTP, message affiché par l'écran de connexion.
const ERRORS: Record<string, { status: number; message: string }> = {
  INVALID_EMAIL: { status: 400, message: "Adresse e-mail invalide." },
  WEAK_PASSWORD: {
    status: 400,
    message: "Le mot de passe doit contenir au moins 6 caractères.",
  },
  EMAIL_TAKEN: {
    status: 409,
    message: "Un compte existe déjà avec cette adresse e-mail.",
  },
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return NextResponse.json(
      { error: "E-mail et mot de passe requis." },
      { status: 400 }
    );
  }
  const name = typeof body.name === "string" ? body.name : null;

  try {
    const user = await registerUser(body.email, body.password, name);
    return NextResponse.json({ ok: true, email: user.email }, { status: 201 });
  } catch (e) {
    const code = e instanceof Error ? e.message : "UNKNOWN";
    const known = ERRORS[code];
    if (known) {
      return NextResponse.json({ error: known.message }, { status: known.status });
    }
    return NextResponse.json(
      { error: "Inscription impossible pour le moment." },
      { status: 500 }
    );
  }
}