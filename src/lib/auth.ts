import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

// Secret de session : obligatoire en production (jamais de secret codé en dur).
// Un repli limité au développement local évite de casser `npm run dev`
// lorsque le fichier .env n'est pas encore renseigné.
const DEV_ONLY_SECRET = "dev-only-secret-never-use-in-production";
export const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV !== "production" ? DEV_ONLY_SECRET : undefined);

const googleConfigured = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

/** Compte de démonstration (identifiants fixes, affichés sur l'écran de connexion). */
export const DEMO_EMAIL = "demo@tasksync.app";
export const DEMO_PASSWORD = "demo1234";

const DEFAULT_LISTS = [
  { name: "Personnel", color: "#10b981", icon: "user", order: 0 },
  { name: "Travail", color: "#8b5cf6", icon: "briefcase", order: 1 },
  { name: "Courses", color: "#f59e0b", icon: "shopping-cart", order: 2 },
  { name: "Idées", color: "#f43f5e", icon: "lightbulb", order: 3 },
];

async function ensureUserAndDefaults(email: string, name?: string | null, image?: string | null, provider?: string) {
  const user = await db.user.upsert({
    where: { email },
    update: { name: name ?? undefined, image: image ?? undefined },
    create: { email, name: name ?? null, image: image ?? null, provider: provider ?? "google" },
  });

  const listCount = await db.list.count({ where: { userId: user.id } });
  if (listCount === 0) {
    await db.list.createMany({
      data: DEFAULT_LISTS.map((l) => ({ ...l, userId: user.id })),
    });
  }
  return user;
}

/** Crée le compte démo (et ses listes par défaut) s'il n'existe pas encore. */
async function ensureDemoUser() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const existing = await db.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    // Compte existant sans mot de passe (créé avant le Sprint 1) : on lui
    // affecte le mot de passe démo pour qu'il reste utilisable partout.
    if (!existing.passwordHash) {
      return db.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
    }
    return existing;
  }
  const created = await db.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Utilisateur démo",
      image: null,
      provider: "credentials",
      passwordHash,
    },
  });
  const listCount = await db.list.count({ where: { userId: created.id } });
  if (listCount === 0) {
    await db.list.createMany({
      data: DEFAULT_LISTS.map((l) => ({ ...l, userId: created.id })),
    });
  }
  return created;
}

/** Inscription : crée un compte e-mail + mot de passe avec ses listes par défaut. */
export async function registerUser(email: string, password: string, name?: string | null) {
  const addr = email.trim().toLowerCase();
  if (!addr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) || addr === DEMO_EMAIL) {
    throw new Error("INVALID_EMAIL");
  }
  if (typeof password !== "string" || password.length < 6) {
    throw new Error("WEAK_PASSWORD");
  }
  const existing = await db.user.findUnique({ where: { email: addr } });
  if (existing) throw new Error("EMAIL_TAKEN");
  const passwordHash = await bcrypt.hash(password, 10);
  const created = await db.user.create({
    data: { email: addr, name: name?.trim() || addr.split("@")[0], image: null, provider: "credentials", passwordHash },
  });
  const listCount = await db.list.count({ where: { userId: created.id } });
  if (listCount === 0) {
    await db.list.createMany({ data: DEFAULT_LISTS.map((l) => ({ ...l, userId: created.id })) });
  }
  return created;
}

async function verifyCredentials(email: string, password: string) {
  const addr = email.trim().toLowerCase();
  let user = await db.user.findUnique({ where: { email: addr } });
  if (addr === DEMO_EMAIL && (!user || !user.passwordHash)) {
    // Première utilisation sur un serveur neuf (compte absent), ou compte
    // démo hérité de l'ancien mode démo (présent mais sans mot de passe) :
    // dans les deux cas ensureDemoUser crée ou complète le compte.
    user = await ensureDemoUser();
  }
  if (!user || !user.passwordHash) {
    return null;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 24 * 60 * 60 },
  providers: [
    ...(googleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
    CredentialsProvider({
      id: "credentials",
      name: "Compte démo",
      credentials: {
        email: { label: "E-mail", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
          return null;
        }
        try {
          const user = await verifyCredentials(email, password);
          if (!user) return null;
          await ensureUserAndDefaults(user.email, user.name, user.image, user.provider);
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
      async jwt({ token, account, profile, user }) {
        if (account?.provider === "google" && profile?.email) {
          try {
            const picture = (profile as { picture?: string | null }).picture ?? null;
            const dbUser = await ensureUserAndDefaults(
              profile.email,
              profile.name,
              picture,
              "google"
            );
          token.id = dbUser.id;
        } catch {
          // keep token without id; session will fall back to email lookup
        }
      }
      if (account?.provider === "credentials" && user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && session.user.email) {
        let id = typeof token.id === "string" ? token.id : undefined;
        if (id) {
          const exists = await db.user.findUnique({
            where: { id },
            select: { id: true },
          });
          if (!exists) id = undefined;
        }
        if (!id) {
          const dbUser = await db.user.findUnique({
            where: { email: session.user.email },
            select: { id: true },
          });
          id = dbUser?.id;
        }
        (session.user as { id?: string }).id = id;
      }
      return session;
    },
  },
};

export const googleEnabled = googleConfigured;
