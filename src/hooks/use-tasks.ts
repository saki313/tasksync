"use client";

/**
 * Hooks de données — couche 100 % locale (IndexedDB).
 *
 * Les composants lisent et écrivent dans le stockage local via les
 * repositories ; la réactivité est assurée par Dexie liveQuery. La
 * synchronisation serveur est transparente (moteur de sync), donc les
 * mêmes hooks fonctionnent en ligne comme hors connexion.
 */

import { useLiveQuery } from "dexie-react-hooks";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { db } from "@/lib/offline/db";
import {
  createTask,
  createList,
  deleteList,
  deleteTask,
  getAllLists,
  getAllTasks,
  updateList,
  updateTask,
  type TaskRepoInput,
  type TaskRepoUpdate,
} from "@/lib/offline/repositories";

export type { TaskRepoInput as TaskInput, TaskRepoUpdate };

/* ------------------------------- Tâches -------------------------------- */

export function useTasks() {
  return useLiveQuery(getAllTasks);
}

export function useCreateTask() {
  return useMutation({
    mutationFn: (input: TaskRepoInput) => createTask(input),
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface TaskUpdate {
  id: string;
  data: TaskRepoUpdate;
}

export function useUpdateTask() {
  return useMutation({
    mutationFn: ({ id, data }: TaskUpdate) => updateTask(id, data),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTask() {
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onError: (e: Error) => toast.error(e.message),
  });
}

/* ------------------------------- Listes -------------------------------- */

export function useLists() {
  return useLiveQuery(getAllLists);
}

export interface ListInput {
  name: string;
  color?: string;
}

export function useCreateList() {
  return useMutation({
    mutationFn: (input: ListInput) => createList(input),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateList() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ListInput> }) =>
      updateList(id, data),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteList() {
  return useMutation({
    mutationFn: (id: string) => deleteList(id),
    onError: (e: Error) => toast.error(e.message),
  });
}
