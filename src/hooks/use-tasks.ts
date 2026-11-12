"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ListDto, TaskDto } from "@/lib/types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Erreur réseau");
  }
  return res.json() as Promise<T>;
}

export interface TaskInput {
  title: string;
  notes?: string | null;
  priority?: number;
  dueDate?: string | null;
  starred?: boolean;
  listId?: string | null;
}

/* ------------------------------- Tâches -------------------------------- */

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchJson<TaskDto[]>("/api/tasks"),
    refetchInterval: 4_000, // synchronisation continue entre appareils
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) =>
      fetchJson<TaskDto>("/api/tasks", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface TaskUpdate {
  id: string;
  data: Partial<TaskInput> & { completed?: boolean };
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: TaskUpdate) =>
      fetchJson<TaskDto>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const previous = qc.getQueryData<TaskDto[]>(["tasks"]);
      qc.setQueryData<TaskDto[]>(["tasks"], (old) =>
        (old ?? []).map((t) =>
          t.id === id
            ? {
                ...t,
                ...data,
                completedAt:
                  data.completed === true
                    ? new Date().toISOString()
                    : data.completed === false
                      ? null
                      : t.completedAt,
              }
            : t
        )
      );
      return { previous };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["tasks"], ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ ok: boolean }>(`/api/tasks/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const previous = qc.getQueryData<TaskDto[]>(["tasks"]);
      qc.setQueryData<TaskDto[]>(["tasks"], (old) => (old ?? []).filter((t) => t.id !== id));
      return { previous };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(["tasks"], ctx.previous);
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/* ------------------------------- Listes -------------------------------- */

export function useLists() {
  return useQuery({
    queryKey: ["lists"],
    queryFn: () => fetchJson<ListDto[]>("/api/lists"),
    refetchInterval: 8_000,
  });
}

export interface ListInput {
  name: string;
  color?: string;
}

export function useCreateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ListInput) =>
      fetchJson<ListDto>("/api/lists", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lists"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ListInput> }) =>
      fetchJson<ListDto>(`/api/lists/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchJson<{ ok: boolean }>(`/api/lists/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lists"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
