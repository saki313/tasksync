import { addDays, nextDay } from "date-fns";

/**
 * Crée une date d'échéance à midi (heure locale) pour le jour donné.
 * Midi évite les problèmes de fuseaux horaires (UTC+/UTC-) au stockage.
 */
export function dueDateFromDay(day: Date): Date {
  const d = new Date(day);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const WEEKDAYS: Array<[RegExp, number]> = [
  [/\b(lundi)\b/, 1],
  [/\b(mardi)\b/, 2],
  [/\b(mercredi)\b/, 3],
  [/\b(jeudi)\b/, 4],
  [/\b(vendredi)\b/, 5],
  [/\b(samedi)\b/, 6],
  [/\b(dimanche)\b/, 0],
];

export interface ParsedQuickAdd {
  title: string;
  dueDate?: Date;
  listId?: string;
  starred?: boolean;
}

/**
 * Analyse une saisie rapide en français :
 *  - « rapport demain »            → échéance demain
 *  - « courses samedi »            → échéance samedi prochain
 *  - « faire le site #travail »    → liste Travail
 *  - « *appeler maman »            → importante (favori)
 */
export function parseQuickAdd(
  input: string,
  lists: Array<{ id: string; name: string }> = []
): ParsedQuickAdd {
  const result: ParsedQuickAdd = { title: input.trim() };
  if (!result.title) return result;

  const lower = stripAccents(input);
  let matched: RegExpMatchArray | null = null;
  let date: Date | undefined;

  const tryMatch = (re: RegExp, make: () => Date) => {
    if (matched) return;
    const m = lower.match(re);
    if (m) {
      matched = m;
      date = make();
    }
  };

  tryMatch(/\baujourd['’]?hui\b|\bauj\b/, () => new Date());
  tryMatch(/\bapres-?demain\b/, () => addDays(new Date(), 2));
  tryMatch(/\bdemain\b/, () => addDays(new Date(), 1));
  tryMatch(/\bsemaine (?:prochaine|suivante)\b/, () => addDays(new Date(), 7));
  for (const [re, day] of WEEKDAYS) {
    tryMatch(re, () => nextDay(new Date(), day as 0 | 1 | 2 | 3 | 4 | 5 | 6));
  }

  let title = result.title;
  if (matched && date) {
    // Retire le mot-clé du titre original (correspondance insensible à la casse)
    const escaped = (matched as RegExpMatchArray)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(escaped, "i"), "").replace(/\s{2,}/g, " ").trim();
    result.dueDate = dueDateFromDay(date);
  }

  // Étoile : préfixe « * »
  if (/^\*/.test(title.trim())) {
    result.starred = true;
    title = title.replace(/^\*/, "").trim();
  }

  // Liste : « #nom »
  const hash = title.match(/#([^\s#]+)/);
  if (hash) {
    const wanted = stripAccents(hash[1]);
    const list = lists.find((l) => stripAccents(l.name).startsWith(wanted));
    if (list) {
      result.listId = list.id;
      title = title.replace(hash[0], "").replace(/\s{2,}/g, " ").trim();
    }
  }

  result.title = title.trim() || input.trim();
  return result;
}

/** Formate une échéance en libellé court français. */
export function formatDueLabel(iso: string): { text: string; kind: "overdue" | "today" | "future" } {
  const due = new Date(iso);
  const now = new Date();
  const startDue = new Date(due);
  startDue.setHours(0, 0, 0, 0);
  const startNow = new Date(now);
  startNow.setHours(0, 0, 0, 0);
  const diffDays = Math.round((startDue.getTime() - startNow.getTime()) / 86_400_000);

  if (diffDays < 0) return { text: `Retard · ${formatDay(due)}`, kind: "overdue" };
  if (diffDays === 0) return { text: "Aujourd’hui", kind: "today" };
  if (diffDays === 1) return { text: "Demain", kind: "future" };
  return { text: formatDay(due), kind: diffDays < 0 ? "overdue" : "future" };
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + "";
}
