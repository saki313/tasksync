"use client";

import * as React from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { addDays, isSameDay } from "date-fns";
import { CalendarDays, Flag, Layers, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { dueDateFromDay } from "@/lib/quick-add";
import type { ListDto, PhaseDto, TaskDto } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface TaskDialogDefaults {
  listId?: string | null;
  phaseId?: string | null;
  dueDate?: Date | null;
  starred?: boolean;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskDto | null;
  defaults?: TaskDialogDefaults;
  lists: ListDto[];
  phases: PhaseDto[];
  onCreate: (input: {
    title: string;
    notes: string | null;
    priority: number;
    dueDate: Date | null;
    listId: string | null;
    phaseId: string | null;
    starred: boolean;
  }) => void;
  onUpdate: (
    id: string,
    data: Partial<{
      title: string;
      notes: string | null;
      priority: number;
      dueDate: Date | null;
      listId: string | null;
      phaseId: string | null;
    }>
  ) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_OPTIONS = [
  { value: 0, label: "Basse", dot: "text-zinc-400" },
  { value: 1, label: "Moyenne", dot: "text-amber-500" },
  { value: 2, label: "Haute", dot: "text-rose-500" },
];

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaults,
  lists,
  phases,
  onCreate,
  onUpdate,
  onDelete,
}: TaskDialogProps) {
  const isEdit = !!task;
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [priority, setPriority] = React.useState(1);
  const [dueDate, setDueDate] = React.useState<Date | null>(null);
  const [listId, setListId] = React.useState<string | null>(null);
  const [phaseId, setPhaseId] = React.useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setNotes(task?.notes ?? "");
      setPriority(task?.priority ?? 1);
      setDueDate(task?.dueDate ? new Date(task.dueDate) : defaults?.dueDate ?? null);
      setListId(task?.listId ?? defaults?.listId ?? null);
      setPhaseId(task?.phaseId ?? defaults?.phaseId ?? null);
      setCalendarOpen(false);
    }
    // Ne dépend que de l'ouverture et de l'identité de la tâche : évite de vider
    // le formulaire quand les données se rafraîchissent pendant l'édition.
  }, [open, task?.id]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Donnez un titre à votre tâche.");
      return;
    }
    if (isEdit && task) {
      onUpdate(task.id, {
        title: trimmed,
        notes: notes.trim() || null,
        priority,
        dueDate,
        listId,
        phaseId,
      });
    } else {
      onCreate({
        title: trimmed,
        notes: notes.trim() || null,
        priority,
        dueDate,
        listId,
        phaseId,
        starred: defaults?.starred ?? false,
      });
    }
    onOpenChange(false);
  };

  const quickDates: Array<{ label: string; date: Date }> = [
    { label: "Aujourd’hui", date: new Date() },
    { label: "Demain", date: addDays(new Date(), 1) },
    { label: "Semaine prochaine", date: addDays(new Date(), 7) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Titre</Label>
            <Input
              id="task-title"
              placeholder="Que devez-vous faire ?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              placeholder="Détails, liens, précisions…"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
            />
          </div>

          {/* Échéance */}
          <div className="space-y-2">
            <Label>Échéance</Label>
            <div className="flex flex-wrap items-center gap-2">
              {quickDates.map((q) => (
                <Button
                  key={q.label}
                  type="button"
                  variant={
                    dueDate && isSameDay(dueDate, q.date) ? "default" : "outline"
                  }
                  size="sm"
                  className="h-8 rounded-full px-3"
                  onClick={() =>
                    setDueDate((d) =>
                      d && isSameDay(d, q.date) ? null : dueDateFromDay(q.date)
                    )
                  }
                >
                  {q.label}
                </Button>
              ))}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 rounded-full px-3"
                  >
                    <CalendarDays className="size-3.5" />
                    {dueDate ? format(dueDate, "d MMM yyyy", { locale: fr }) : "Choisir…"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    locale={fr}
                    selected={dueDate ?? undefined}
                    onSelect={(day) => {
                      setDueDate(day ? dueDateFromDay(day) : null);
                      setCalendarOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              {dueDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0 text-muted-foreground"
                  aria-label="Supprimer l’échéance"
                  onClick={() => setDueDate(null)}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Liste */}
            <div className="space-y-2">
              <Label>Liste</Label>
              <Select
                value={listId ?? "none"}
                onValueChange={(v) => setListId(v === "none" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Aucune liste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune liste</SelectItem>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: l.color }}
                        />
                        {l.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Phase */}
            <div className="space-y-2">
              <Label>Phase</Label>
              <Select
                value={phaseId ?? "none"}
                onValueChange={(v) => setPhaseId(v === "none" ? null : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Aucune phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune phase</SelectItem>
                  {phases.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <Layers className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        {p.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priorité */}
            <div className="space-y-2">
              <Label>Priorité</Label>
              <Select
                value={String(priority)}
                onValueChange={(v) => setPriority(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      <span className="flex items-center gap-2">
                        <Flag className={cn("size-4", p.dot)} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          {isEdit && task ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                onDelete(task.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="size-4" />
              Supprimer
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={submit}>{isEdit ? "Enregistrer" : "Ajouter"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
