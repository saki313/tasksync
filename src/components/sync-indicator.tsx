"use client";

import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useIsFetching } from "@tanstack/react-query";
import { useTasks } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const { dataUpdatedAt } = useTasks();
  const isFetching = useIsFetching({ queryKey: ["tasks"] }) > 0;

  const label = dataUpdatedAt
    ? `Synchronisé ${formatDistanceToNow(new Date(dataUpdatedAt), {
        addSuffix: true,
        locale: fr,
      })}`
    : "Synchronisation…";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-live="polite"
            aria-label={label}
          >
            <span className="relative flex size-2">
              <span
                className={cn(
                  "absolute inline-flex size-full rounded-full opacity-60",
                  isFetching ? "animate-ping bg-emerald-500" : "bg-emerald-500/70"
                )}
              />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <RefreshCw
              className={cn("size-3.5", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            {!compact && <span className="hidden sm:inline">{label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Sync auto · {label}</p>
          <p className="text-muted-foreground">
            Vos appareils restent à jour en continu.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
