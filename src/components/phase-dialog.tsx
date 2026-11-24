"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { PhaseDto } from "@/lib/types";

interface PhaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase?: PhaseDto | null;
  onCreate: (input: { title: string; description: string | null }) => void;
  onUpdate: (id: string, data: { title: string; description: string | null }) => void;
  onDelete?: (id: string) => void;
}

export function PhaseDialog({
  open,
  onOpenChange,
  phase,
  onCreate,
  onUpdate,
  onDelete,
}: PhaseDialogProps) {
  const isEdit = !!phase;
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTitle(phase?.title ?? "");
      setDescription(phase?.description ?? "");
    }
  }, [open, phase?.id]);

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (isEdit && phase) {
      onUpdate(phase.id, { title: trimmed, description: description.trim() || null });
    } else {
      onCreate({ title: trimmed, description: description.trim() || null });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier la phase" : "Nouvelle phase"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phase-title">Titre</Label>
            <Input
              id="phase-title"
              placeholder="Ex. : Préparation, Déploiement, Vérification…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase-description">Description (facultative)</Label>
            <Textarea
              id="phase-description"
              placeholder="Objectif de cette étape…"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          {isEdit && phase && onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                onDelete(phase.id);
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
            <Button onClick={submit} disabled={!title.trim()}>
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
