"use client";

import * as React from "react";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ListDto } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = [
  "#10b981",
  "#14b8a6",
  "#8b5cf6",
  "#f43f5e",
  "#f97316",
  "#f59e0b",
  "#ec4899",
  "#84cc16",
];

interface ListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list?: ListDto | null;
  onCreate: (input: { name: string; color: string }) => void;
  onUpdate: (id: string, data: { name: string; color: string }) => void;
  onDelete: (id: string) => void;
}

export function ListDialog({
  open,
  onOpenChange,
  list,
  onCreate,
  onUpdate,
  onDelete,
}: ListDialogProps) {
  const isEdit = !!list;
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(COLORS[0]);

  React.useEffect(() => {
    if (open) {
      setName(list?.name ?? "");
      setColor(list?.color ?? COLORS[0]);
    }
  }, [open, list]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Donnez un nom à votre liste.");
      return;
    }
    if (isEdit && list) onUpdate(list.id, { name: trimmed, color });
    else onCreate({ name: trimmed, color });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la liste" : "Nouvelle liste"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="list-name">Nom</Label>
            <Input
              id="list-name"
              placeholder="Ex. : Maison, Sport, Projets…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={60}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Couleur</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Couleur ${c}`}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95",
                    color === c && "ring-2 ring-offset-2 ring-offset-background"
                  )}
                  style={{ backgroundColor: c, ...(color === c ? { boxShadow: `0 0 0 2px ${c}` } : {}) }}
                >
                  {color === c && <Check className="size-4 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          {isEdit && list ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer la liste « {list.name} » ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Les tâches de cette liste ne seront pas supprimées : elles
                    resteront visibles dans « Toutes ». Cette action est
                    définitive.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={() => {
                      onDelete(list.id);
                      onOpenChange(false);
                    }}
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button onClick={submit}>{isEdit ? "Enregistrer" : "Créer"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
