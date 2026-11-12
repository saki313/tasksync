"use client";

import { memo } from "react";
import { Check, Flag, StickyNote, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueLabel } from "@/lib/quick-add";
import type { TaskDto } from "@/lib/types";

const PRIORITY_STYLE: Record<number, { border: string; label: string; icon: string }> = {
  2: { border: "border-rose-500", label: "Haute", icon: "text-rose-500" },
  1: { border: "border-amber-500", label: "Moyenne", icon: "text-amber-500" },
  0: { border: "border-zinc-400", label: "Basse", icon: "text-zinc-400" },
};

interface TaskItemProps {
  task: TaskDto;
  onToggle: (task: TaskDto) => void;
  onToggleStar: (task: TaskDto) => void;
  onEdit: (task: TaskDto) => void;
}

export const TaskItem = memo(function TaskItem({
  task,
  onToggle,
  onToggleStar,
  onEdit,
}: TaskItemProps) {
  const due = task.dueDate ? formatDueLabel(task.dueDate) : null;
  const priority = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE[1];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Tâche : ${task.title}. Ouvrir les détails`}
      onClick={() => onEdit(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(task);
        }
      }}
      className={cn(
        "group animate-in fade-in slide-in-from-bottom-1 flex cursor-pointer items-start gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:border-emerald-500/40 hover:bg-accent/40",
        task.completed && "opacity-60"
      )}
    >
      {/* Case à cocher */}
      <button
        type="button"
        role="checkbox"
        aria-checked={task.completed}
        aria-label={task.completed ? "Marquer comme à faire" : "Marquer comme terminée"}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task);
        }}
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-90",
          task.completed
            ? "border-primary bg-primary text-primary-foreground"
            : cn(priority.border, "bg-transparent hover:bg-accent")
        )}
      >
        {task.completed && <Check className="size-3" strokeWidth={3.5} />}
      </button>

      {/* Contenu */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "break-words text-sm font-medium leading-snug",
            task.completed && "line-through decoration-2"
          )}
        >
          {task.title}
        </p>

        {(due || task.list || task.notes || task.priority === 2) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {due && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 font-medium",
                  due.kind === "overdue" && "text-rose-600 dark:text-rose-400",
                  due.kind === "today" && "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {due.text}
              </span>
            )}
            {task.list && (
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: task.list.color }}
                />
                {task.list.name}
              </span>
            )}
            {task.priority === 2 && (
              <span className="inline-flex items-center gap-1 text-rose-500">
                <Flag className="size-3" /> Haute
              </span>
            )}
            {task.priority === 0 && !task.completed && (
              <span className="inline-flex items-center gap-1">
                <Flag className={cn("size-3", priority.icon)} /> Basse
              </span>
            )}
            {task.notes && (
              <span className="inline-flex items-center gap-1" title={task.notes}>
                <StickyNote className="size-3" /> Note
              </span>
            )}
          </div>
        )}
      </div>

      {/* Favori */}
      <button
        type="button"
        aria-label={task.starred ? "Retirer des importantes" : "Marquer comme importante"}
        aria-pressed={task.starred}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(task);
        }}
        className={cn(
          "mt-0.5 shrink-0 rounded-md p-1 transition-opacity active:scale-90",
          task.starred
            ? "text-amber-400"
            : "text-muted-foreground/50 hover:text-amber-400 sm:opacity-0 sm:group-hover:opacity-100"
        )}
      >
        <Star className={cn("size-4.5", task.starred && "fill-amber-400")} />
      </button>
    </div>
  );
});
