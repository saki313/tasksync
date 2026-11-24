/**
 * Calcul de progression d'une phase — 100 % dérivé des données, jamais stocké.
 *
 * Formule : progression = (éléments terminés / éléments totaux) × 100.
 * Une phase vide vaut 0 %, une phase entièrement terminée vaut 100 %.
 */

export interface PhaseProgress {
  total: number;
  completed: number;
  percent: number;
}

export function computePhaseProgress(
  tasks: ReadonlyArray<{ completed: boolean }>
): PhaseProgress {
  const total = tasks.length;
  const completed = tasks.reduce((acc, t) => acc + (t.completed ? 1 : 0), 0);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, percent };
}
