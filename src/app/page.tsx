"use client";

import { useSession } from "next-auth/react";
import { LoginScreen } from "@/components/login-screen";
import { Logo } from "@/components/logo";
import { TaskApp } from "@/components/task-app";

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

  if (status === "loading") return <Splash />;
  if (!session?.user) return <LoginScreen />;
  return <TaskApp />;
}
