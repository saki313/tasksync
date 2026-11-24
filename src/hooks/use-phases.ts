"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAllPhases, createPhase, deletePhase, updatePhase, reorderPhases, type PhaseRepoInput } from "@/lib/offline/repositories";

export type PhaseInput = PhaseRepoInput;

/** Phases triées par position (lecture locale réactive). */
export function usePhases() {
  return useLiveQuery(getAllPhases);
}

export function useCreatePhase() {
  return useMutation({
    mutationFn: (input: PhaseInput) => createPhase(input),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePhase() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PhaseInput> }) =>
      updatePhase(id, data),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePhase() {
  return useMutation({
    mutationFn: (id: string) => deletePhase(id),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** `orderedIds` : liste complète des ids de phases dans le nouvel ordre. */
export function useReorderPhases() {
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderPhases(orderedIds),
    onError: (e: Error) => toast.error(e.message),
  });
}
