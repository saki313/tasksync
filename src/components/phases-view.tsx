"use client";

import * as React from "react";
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Inbox,
  Layers,
  Pencil,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { TaskItem } from "@/components/task-item";
import { computePhaseProgress } from "@/lib/offline/progress";
import type { PhaseDto, TaskDto } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PhasesViewProps {
  phases: PhaseDto[];
  tasks: TaskDto[];
  onToggle: (task: TaskDto) => void;
  onToggleStar: (task: TaskDto) => void;
  onEdit: (task: TaskDto) => void;
  onCreatePhase: () => void;
  onEditPhase: (phase: PhaseDto) => void;
  onDeletePhase: (phase: PhaseDto) => void;
  onReorder: (orderedIds: string[]) => void;
  onMoveTask: (taskId: string, phaseId: string | null) => void;
  onQuickAdd: (phaseId: string, title: string) => void;
  onAddTask: (phaseId: string) => void;
}

function sortPhaseTasks(a: TaskDto, b: TaskDto): number {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  if (a.completed && b.completed) {
    return +new Date(b.completedAt ?? 0) - +new Date(a.completedAt ?? 0);
  }
  if (a.starred !== b.starred) return a.starred ? -1 : 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  const ad = a.dueDate ? +new Date(a.dueDate) : Number.POSITIVE_INFINITY;
  const bd = b.dueDate ? +new Date(b.dueDate) : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  return +new Date(b.createdAt) - +new Date(a.createdAt);
}

export function PhasesView({
  phases,
  tasks,
  onToggle,
  onToggleStar,
  onEdit,
  onCreatePhase,
  onEditPhase,
  onDeletePhase,
  onReorder,
  onMoveTask,
  onQuickAdd,
  onAddTask,
}: PhasesViewProps) {
  const orderedIds = phases.map((p) => p.id);
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= orderedIds.length) return;
    const next = [...orderedIds];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  };

  const withoutPhase = tasks.filter((t) => !t.phaseId);

  if (phases.length === 0 && withoutPhase.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
        <Layers className="size-10 text-muted-foreground/50" />
        <div>
          <p className="font-medium">Aucune phase pour l’instant</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Découpez un projet en étapes : chaque phase compte ses tâches et
            affiche sa progression automatiquement.
          </p>
        </div>
        <Button onClick={onCreatePhase} className="gap-1.5">
          <Plus className="size-4" />
          Créer une phase
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {phases.length} phase(s) · progression calculée automatiquement
        </p>
        <Button
          onClick={onCreatePhase}
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5"
        >
          <Plus className="size-4" />
          Nouvelle phase
        </Button>
      </div>
      {phases.map((phase, index) => (
        <PhaseCard
          key={phase.id}
          phase={phase}
          tasks={tasks.filter((t) => t.phaseId === phase.id)}
          canUp={index > 0}
          canDown={index < phases.length - 1}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          phases={phases}
          onToggle={onToggle}
          onToggleStar={onToggleStar}
          onEdit={onEdit}
          onEditPhase={onEditPhase}
          onDeletePhase={onDeletePhase}
          onMoveTask={onMoveTask}
          onQuickAdd={onQuickAdd}
          onAddTask={onAddTask}
        />
      ))}

      {withoutPhase.length > 0 && (
        <PhaseCard
          phase={{
            id: "__none__",
            title: "Sans phase",
            description: "Tâches hors phases — glissez-les dans une étape via le menu.",
            position: phases.length,
            createdAt: "",
            updatedAt: "",
          }}
          tasks={withoutPhase}
          phases={phases}
          onToggle={onToggle}
          onToggleStar={onToggleStar}
          onEdit={onEdit}
          onEditPhase={onEditPhase}
          onDeletePhase={onDeletePhase}
          onMoveTask={onMoveTask}
          onQuickAdd={onQuickAdd}
          onAddTask={onAddTask}
          virtual
        />
      )}
    </div>
  );
}

interface PhaseCardProps {
  phase: PhaseDto;
  tasks: TaskDto[];
  phases: PhaseDto[];
  virtual?: boolean;
  canUp?: boolean;
  canDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggle: (task: TaskDto) => void;
  onToggleStar: (task: TaskDto) => void;
  onEdit: (task: TaskDto) => void;
  onEditPhase: (phase: PhaseDto) => void;
  onDeletePhase: (phase: PhaseDto) => void;
  onMoveTask: (taskId: string, phaseId: string | null) => void;
  onQuickAdd: (phaseId: string, title: string) => void;
  onAddTask: (phaseId: string) => void;
}

function PhaseCard({
  phase,
  tasks,
  phases,
  virtual = false,
  canUp = false,
  canDown = false,
  onMoveUp,
  onMoveDown,
  onToggle,
  onToggleStar,
  onEdit,
  onEditPhase,
  onDeletePhase,
  onMoveTask,
  onQuickAdd,
  onAddTask,
}: PhaseCardProps) {
  const [quickValue, setQuickValue] = React.useState("");
  const progress = computePhaseProgress(tasks);
  const done = progress.percent === 100 && progress.total > 0;

  const submitQuick = () => {
    const text = quickValue.trim();
    if (!text) return;
    onQuickAdd(phase.id, text);
    setQuickValue("");
  };

  return (
    <section
      aria-label={`Phase : ${phase.title}`}
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        done && "border-emerald-500/50"
      )}
    >
      {/* En-tête : titre, actions, progression */}
      <div className="flex items-start gap-3 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Layers className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <h2 className="truncate font-semibold leading-tight">{phase.title}</h2>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
              {progress.total === 0
                ? "0 %"
                : `${progress.completed}/${progress.total} · ${progress.percent} %`}
            </span>
          </div>
          {phase.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {phase.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {!virtual && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Monter la phase"
                disabled={!canUp}
                onClick={onMoveUp}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Descendre la phase"
                disabled={!canDown}
                onClick={onMoveDown}
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={`Modifier la phase ${phase.title}`}
                onClick={() => onEditPhase(phase)}
              >
                <Pencil className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      <div className="px-4 pt-3">
        <Progress
          value={progress.percent}
          aria-label={`Progression de la phase ${phase.title} : ${progress.percent} %`}
          className={cn("h-2", done && "[&>div]:bg-emerald-500")}
        />
      </div>

      {/* Tâches de la phase */}
      <div className="space-y-2 px-4 py-3">
        {tasks.length === 0 ? (
          <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Inbox className="size-3.5" />
            Aucune tâche dans cette phase.
          </p>
        ) : (
          tasks.sort(sortPhaseTasks).map((task) => (
            <div key={task.id} className="group/task flex items-start gap-1">
              <div className="min-w-0 flex-1">
                <TaskItem
                  task={task}
                  onToggle={onToggle}
                  onToggleStar={onToggleStar}
                  onEdit={onEdit}
                />
              </div>
              {!virtual && phases.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-1 size-7 shrink-0 rounded-md text-muted-foreground transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover/task:opacity-100"
                      aria-label={`Déplacer la tâche « ${task.title} » vers une autre phase`}
                    >
                      <ArrowRightLeft className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Déplacer vers</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {phases
                      .filter((p) => p.id !== phase.id)
                      .map((p) => (
                        <DropdownMenuItem key={p.id} onClick={() => onMoveTask(task.id, p.id)}>
                          <Layers className="size-4 text-muted-foreground" />
                          {p.title}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {virtual && phases.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-1 size-7 shrink-0 rounded-md text-muted-foreground transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover/task:opacity-100"
                      aria-label={`Ajouter la tâche « ${task.title} » à une phase`}
                    >
                      <ArrowRightLeft className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Ajouter à la phase</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {phases.map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => onMoveTask(task.id, p.id)}>
                        <Layers className="size-4 text-muted-foreground" />
                        {p.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))
        )}
      </div>

      {/* Ajout rapide dans la phase */}
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <Input
          value={quickValue}
          onChange={(e) => setQuickValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitQuick()}
          placeholder={`Ajouter à « ${phase.title} »…`}
          aria-label={`Ajouter une tâche à la phase ${phase.title}`}
          className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 text-xs text-primary"
          onClick={() => onAddTask(phase.id)}
        >
          Détails…
        </Button>
      </div>
    </section>
  );
}
