"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Download, Loader2, Monitor, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/components/pwa";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

const FEATURES = [
  {
    icon: Smartphone,
    title: "Téléphone, Windows, Ubuntu",
    text: "Une seule liste, identique sur tous vos écrans.",
  },
  {
    icon: RefreshCw,
    title: "Synchronisation automatique",
    text: "Vos tâches se mettent à jour en temps réel partout.",
  },
  {
    icon: Monitor,
    title: "S’installe comme une vraie app",
    text: "Ajoutez-la à l’écran d’accueil ou au menu des apps.",
  },
  {
    icon: ShieldCheck,
    title: "Compte Google sécurisé",
    text: "Connectez-vous avec votre compte Google. Espace privé.",
  },
];

export function LoginScreen() {
  const [googleAvailable, setGoogleAvailable] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(false);
  const { canInstall, install } = useInstallPrompt();

  React.useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((providers: Record<string, unknown>) => {
        setGoogleAvailable("google" in providers);
      })
      .catch(() => setGoogleAvailable(false));
  }, []);

  const handleSignIn = () => {
    setLoading(true);
    void signIn("google", { callbackUrl: "/" });
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-emerald-50 via-background to-teal-50/60 dark:from-zinc-950 dark:via-background dark:to-emerald-950/30">
      {/* Décor */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 size-[480px] -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-900/20"
      />

      <main className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center gap-10 px-4 py-12 lg:flex-row lg:gap-16">
        {/* Colonne présentation */}
        <section className="max-w-md text-center lg:text-left">
          <div className="mb-6 flex items-center justify-center gap-3 lg:justify-start">
            <Logo className="size-14" />
            <span className="text-3xl font-bold tracking-tight">TaskSync</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Vos tâches,{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              sur tous vos écrans
            </span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            La plateforme de gestion de tâches synchronisée avec votre compte
            Google — téléphone, PC Windows et Ubuntu.
          </p>

          <ul className="mt-8 space-y-4 text-left">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <f.icon className="size-4.5" />
                </span>
                <div>
                  <p className="font-medium leading-tight">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Carte connexion */}
        <section className="w-full max-w-sm">
          <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-emerald-900/5">
            <h2 className="text-xl font-semibold">Connexion</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connectez-vous avec votre compte Google.
            </p>

            <div className="mt-6 space-y-3">
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-3"
                disabled={loading || googleAvailable === false}
                onClick={handleSignIn}
              >
                {loading ? <Loader2 className="size-5 animate-spin" /> : <GoogleIcon />}
                Continuer avec Google
              </Button>

              {googleAvailable === false && (
                <p className="rounded-lg border border-dashed bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                  La connexion Google n’est pas encore configurée sur ce serveur :
                  ajoutez les clés{" "}
                  <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code> et{" "}
                  <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code>
                  {" "}puis redémarrez l’application (voir le guide LISEZMOI.txt).
                </p>
              )}
            </div>

            {canInstall && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-4 w-full text-primary"
                onClick={install}
              >
                <Download className="size-4" />
                Installer l’application sur cet appareil
              </Button>
            )}
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Vos données restent privées : chaque compte ne voit que ses propres tâches.
          </p>
        </section>
      </main>
    </div>
  );
}
