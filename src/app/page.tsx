"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { LoginScreen } from "@/components/login-screen";
import { Logo } from "@/components/logo";
import { TaskApp } from "@/components/task-app";
import { useLocalUser } from "@/hooks/use-sync";
import type { LocalUser } from "@/lib/offline/db";

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Logo className="size-16 animate-pulse" />
        <p className="text-sm text-muted-foreground">Chargement de TaskSync…</p>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const localUser = useLocalUser();

  if (status === "loading") return <Splash />;

  // Priorité à la session vérifiée ; sinon l'utilisateur connu localement
  // fait foi (mode hors connexion, ou reprise après une panne réseau).
  // Si la session a réellement expiré, le serveur répondra 401 au moteur de
  // synchronisation, qui provoquera un rechargement → écran de connexion.
  const sessionUser = session?.user as
    | { id?: string; name?: string | null; email?: string; image?: string | null }
    | undefined;
  const user = sessionUser ?? localUser;
  if (!user) return <LoginScreen />;

  const localMode = !sessionUser;
  return <TaskApp localUser={user} localMode={localMode} />;
}
