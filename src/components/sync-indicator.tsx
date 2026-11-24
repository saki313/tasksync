"use client";

import * as React from "react";
import { AlertTriangle, CloudOff, Loader2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useSync } from "@/hooks/use-sync";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Indicateur d'état de synchronisation :
 * en ligne · hors ligne · synchronisation en cours · modifications en
 * attente · synchronisation réussie · erreur de synchronisation.
 */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { state, syncNow } = useSync();
  const [busy, setBusy] = React.useState(false);

  const label = !state.online
    ? "Hors ligne"
    : state.syncing
      ? "Synchronisation…"
      : state.lastError
        ? "Erreur de synchronisation"
        : state.pendingCount > 0
          ? `${state.pendingCount} modification(s) en attente`
          : state.lastSyncAt
            ? `En ligne · synchronisé ${formatDistanceToNow(new Date(state.lastSyncAt), {
                addSuffix: true,
                locale: fr,
              })}`
            : "En ligne";

  const tone = !state.online
    ? { dot: "bg-zinc-400", text: "text-zinc-500", icon: CloudOff }
    : state.syncing
      ? { dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", icon: Loader2 }
      : state.lastError
        ? { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", icon: AlertTriangle }
        : state.pendingCount > 0
          ? { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", icon: RefreshCw }
          : { dot: "bg-emerald-500", text: "text-muted-foreground", icon: RefreshCw };

  const Icon = tone.icon;

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await syncNow();
    } finally {
      setBusy(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={retry}
            aria-live="polite"
            aria-label={`État de synchronisation : ${label}. Cliquer pour réessayer.`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors hover:bg-accent",
              tone.text
            )}
          >
            <span className="relative flex size-2">
              {state.syncing && (
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-60" />
              )}
              <span className={cn("relative inline-flex size-2 rounded-full", tone.dot)} />
            </span>
            <Icon
              className={cn(
                "size-3.5",
                state.syncing && "animate-spin",
                state.pendingCount > 0 && !state.syncing && "animate-pulse"
              )}
              aria-hidden="true"
            />
            {!compact && <span className="hidden sm:inline">{label}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-72">
          <p className="font-medium">{label}</p>
          <p className="text-muted-foreground">
            {!state.online
              ? "Vos modifications restent enregistrées sur cet appareil et partiront dès le retour d’Internet."
              : state.lastError
                ? state.lastError + " — nouvelle tentative automatique en cours."
                : state.failedCount > 0
                  ? `${state.failedCount} opération(s) rejetée(s) par le serveur.`
                  : state.conflictCount > 0
                    ? `${state.conflictCount} conflit(s) résolu(s) automatiquement.`
                    : "Toutes vos données sont à jour sur tous vos appareils."}
          </p>
          <p className="text-muted-foreground">
            Cliquez pour synchroniser maintenant.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
