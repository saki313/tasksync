import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";

// Secret de session : variable d'environnement si présente,
// sinon valeur de repli explicite pour garantir un secret
// TOUJOURS identique entre le build et l'exécution.
export const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ??
  "edf85f60823e8368324a59c0c6b833c44b88b26e09fd82cc";

const googleConfigured = !!(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

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

export const authOptions: NextAuthOptions = {
  trustHost: true,
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
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        try {
          const dbUser = await ensureUserAndDefaults(
            profile.email,
            profile.name,
            profile.picture ?? null,
            "google"
          );
          token.id = dbUser.id;
        } catch {
          // keep token without id; session will fall back to email lookup
        }
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
