"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import {
  AlertCircle,
  Download,
  KeyRound,
  Loader2,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    title: "Connexion sécurisée",
    text: "Votre compte e-mail, Google ou le compte de démonstration. Espace privé.",
  },
];

export function LoginScreen() {
  const [googleAvailable, setGoogleAvailable] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("demo@tasksync.app");
  const [password, setPassword] = React.useState("demo1234");
  const [error, setError] = React.useState<string | null>(null);
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

  const handleCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("E-mail ou mot de passe incorrect.");
        setLoading(false);
        return;
      }
      // Recharge pour charger la session authentifiée.
      window.location.assign("/");
    } catch {
      setError("Connexion impossible. Vérifiez votre accès réseau.");
      setLoading(false);
    }
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Inscription impossible. Réessayez.");
        setLoading(false);
        return;
      }
      // Compte créé : connexion immédiate avec les mêmes identifiants.
      const login = await signIn("credentials", { email, password, redirect: false });
      if (login?.error) {
        setMode("login");
        setError("Compte créé. Connectez-vous avec vos identifiants.");
        setLoading(false);
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Inscription impossible. Vérifiez votre accès réseau.");
      setLoading(false);
    }
  };

  const switchMode = () => {
    setError(null);
    setLoading(false);
    if (mode === "login") {
      setMode("signup");
      setEmail("");
      setPassword("");
    } else {
      setMode("login");
      setEmail("demo@tasksync.app");
      setPassword("demo1234");
    }
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
            La gestion de tâches offline-first : fonctionne sans Internet,
            se synchronise seule sur tous vos appareils.
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
            <h2 className="text-xl font-semibold">
              {mode === "login" ? "Connexion" : "Créer un compte"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login"
                ? "Compte de démonstration, compte Google ou compte e-mail."
                : "Un e-mail et un mot de passe (6 caractères minimum) suffisent."}
            </p>

            <form
              className="mt-5 space-y-3"
              onSubmit={mode === "login" ? handleCredentials : handleSignup}
            >
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Nom (optionnel)</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                    maxLength={60}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="login-email">E-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@tasksync.app"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Mot de passe</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <p
                  className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs leading-relaxed text-destructive"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <KeyRound className="size-4.5" />
                )}
                {mode === "login" ? "Se connecter" : "Créer mon compte"}
              </Button>

              {mode === "login" && (
                <p className="rounded-lg border border-dashed bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                  Compte de démonstration :
                  <br />
                  <code className="rounded bg-muted px-1">demo@tasksync.app</code> /{" "}
                  <code className="rounded bg-muted px-1">demo1234</code>
                </p>
              )}
            </form>

            {mode === "login" && (
              <>
                <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  ou
                  <span className="h-px flex-1 bg-border" />
                </div>

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
                  <p className="mt-3 rounded-lg border border-dashed bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                    La connexion Google n’est pas encore configurée sur ce serveur :
                    ajoutez les clés{" "}
                    <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code> et{" "}
                    <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code>
                    {" "}puis redémarrez l’application (voir le guide LISEZMOI.txt).
                  </p>
                )}
              </>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-4 w-full text-primary"
              onClick={switchMode}
              disabled={loading}
            >
              {mode === "login"
                ? "Pas encore de compte ? Créer un compte"
                : "Déjà un compte ? Se connecter"}
            </Button>

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