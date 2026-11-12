"use client";

import * as React from "react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  endOfDay,
  format,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Inbox,
  LayoutList,
  LogOut,
  Menu,
  Moon,
  PartyPopper,
  Pencil,
  Plus,
  Search,
  SearchX,
  Star,
  Sun,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/logo";
import { InstallButton, useInstallPrompt } from "@/components/pwa";
import { ListDialog } from "@/components/list-dialog";
import { SyncIndicator } from "@/components/sync-indicator";
import { TaskDialog, type TaskDialogDefaults } from "@/components/task-dialog";
import { TaskItem } from "@/components/task-item";
import {
  useCreateList,
  useCreateTask,
  useDeleteList,
  useDeleteTask,
  useLists,
  useTasks,
  useUpdateList,
  useUpdateTask,
} from "@/hooks/use-tasks";
import { dueDateFromDay, parseQuickAdd, stripAccents } from "@/lib/quick-add";
import type { ListDto, TaskDto, View } from "@/lib/types";
import { cn } from "@/lib/utils";

const SMART_VIEWS = [
  { id: "today", label: "Aujourd’hui", icon: CalendarCheck2 },
  { id: "upcoming", label: "Planifiées", icon: CalendarDays },
  { id: "all", label: "Toutes", icon: Inbox },
  { id: "starred", label: "Importantes", icon: Star },
  { id: "completed", label: "Terminées", icon: CheckCircle2 },
] as const;

function sortTasks(a: TaskDto, b: TaskDto): number {
  if (a.starred !== b.starred) return a.starred ? -1 : 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  const ad = a.dueDate ? +new Date(a.dueDate) : Number.POSITIVE_INFINITY;
  const bd = b.dueDate ? +new Date(b.dueDate) : Number.POSITIVE_INFINITY;
  if (ad !== bd) return ad - bd;
  return +new Date(b.createdAt) - +new Date(a.createdAt);
}

export function TaskApp() {
  const { data: session } = useSession();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { data: lists = [] } = useLists();
  const { canInstall, install } = useInstallPrompt();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createList = useCreateList();
  const updateList = useUpdateList();
  const deleteList = useDeleteList();

  const [view, setView] = React.useState<View>({ type: "smart", id: "today" });
  const [search, setSearch] = React.useState("");
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<TaskDto | null>(null);
  const [taskDefaults, setTaskDefaults] = React.useState<TaskDialogDefaults>({});
  const [listDialogOpen, setListDialogOpen] = React.useState(false);
  const [editingList, setEditingList] = React.useState<ListDto | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const user = session?.user;

  /* ------------------------------ Statistiques ----------------------------- */
  const now = new Date();
  const endToday = endOfDay(now);
  const startToday = startOfDay(now);
  const stats = (() => {
    const active = tasks.filter((t) => !t.completed);
    return {
      today: active.filter(
        (t) => t.dueDate && new Date(t.dueDate) <= endToday
      ).length,
      upcoming: active.filter(
        (t) => t.dueDate && new Date(t.dueDate) > endToday
      ).length,
      all: active.length,
      starred: active.filter((t) => t.starred).length,
      completed: tasks.length - active.length,
      overdue: active.filter(
        (t) => t.dueDate && isBefore(startOfDay(new Date(t.dueDate)), startToday)
      ).length,
      doneToday: tasks.filter(
        (t) =>
          t.completed &&
          t.completedAt &&
          isSameDay(new Date(t.completedAt), now)
      ).length,
    };
  })();

  /* ------------------------------ Liste visible ---------------------------- */
  const visibleTasks = (() => {
    const q = search.trim();
    if (q) {
      const needle = stripAccents(q.toLowerCase());
      return tasks
        .filter(
          (t) =>
            stripAccents(t.title.toLowerCase()).includes(needle) ||
            (t.notes && stripAccents(t.notes.toLowerCase()).includes(needle))
        )
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    }

    let result: TaskDto[];
    if (view.type === "list") {
      result = tasks.filter((t) => !t.completed && t.listId === view.id);
    } else {
      switch (view.id) {
        case "today":
          result = tasks.filter(
            (t) => !t.completed && t.dueDate && new Date(t.dueDate) <= endToday
          );
          break;
        case "upcoming":
          result = tasks.filter(
            (t) => !t.completed && t.dueDate && new Date(t.dueDate) > endToday
          );
          break;
        case "starred":
          result = tasks.filter((t) => !t.completed && t.starred);
          break;
        case "completed":
          result = tasks.filter((t) => t.completed);
          break;
        default:
          result = tasks.filter((t) => !t.completed);
      }
    }

    return view.type === "smart" && view.id === "completed"
      ? [...result].sort(
          (a, b) =>
            +new Date(b.completedAt ?? 0) - +new Date(a.completedAt ?? 0)
        )
      : [...result].sort(sortTasks);
  })();

  const activeList =
    view.type === "list" ? lists.find((l) => l.id === view.id) : null;

  /* -------------------------------- Actions -------------------------------- */
  const handleToggle = (task: TaskDto) => {
    const next = !task.completed;
    updateTask.mutate({ id: task.id, data: { completed: next } });
    if (next) {
      toast.success("Tâche terminée", {
        action: {
          label: "Annuler",
          onClick: () =>
            updateTask.mutate({ id: task.id, data: { completed: false } }),
        },
      });
    }
  };

  const handleToggleStar = (task: TaskDto) => {
    updateTask.mutate({ id: task.id, data: { starred: !task.starred } });
  };

  const openCreate = () => {
    setEditingTask(null);
    setTaskDefaults({
      listId: view.type === "list" ? view.id : null,
      dueDate:
        view.type === "smart" && view.id === "today" ? new Date() : null,
      starred: view.type === "smart" && view.id === "starred" ? true : false,
    });
    setTaskDialogOpen(true);
  };

  const openEdit = (task: TaskDto) => {
    setEditingTask(task);
    setTaskDefaults({});
    setTaskDialogOpen(true);
  };

  const handleQuickAdd = (text: string) => {
    const parsed = parseQuickAdd(text, lists);
    createTask.mutate(
      {
        title: parsed.title,
        priority: 1,
        dueDate:
          parsed.dueDate?.toISOString() ??
          (view.type === "smart" && view.id === "today"
            ? dueDateFromDay(new Date()).toISOString()
            : null),
        listId:
          parsed.listId ?? (view.type === "list" ? view.id : null),
        starred: parsed.starred ?? false,
      },
      {
        onSuccess: () => toast.success("Tâche ajoutée"),
      }
    );
  };

  const handleSignOut = () => signOut({ callbackUrl: "/" });

  const navigate = (v: View) => {
    setView(v);
    setSearch("");
    setDrawerOpen(false);
  };

  /* ------------------------------- Contenus -------------------------------- */
  const viewTitle =
    view.type === "list"
      ? (activeList?.name ?? "Liste")
      : SMART_VIEWS.find((v) => v.id === view.id)!.label;

  const viewSubtitle =
    search.trim()
      ? `${visibleTasks.length} résultat(s)`
      : view.type === "smart" && view.id === "today"
        ? format(now, "EEEE d MMMM yyyy", { locale: fr })
        : view.type === "list"
          ? `${visibleTasks.length} tâche(s) en cours`
          : {
              upcoming: "Toutes les tâches à venir",
              all: "Tout ce qu’il vous reste à faire",
              starred: "Vos tâches favorites",
              completed: "Historique de vos tâches terminées",
              today: "",
            }[view.id] ?? "";

  const sidebar = (
    <SidebarContent
      view={view}
      onNavigate={navigate}
      lists={lists}
      stats={stats}
      user={user ?? undefined}
      onAddList={() => {
        setEditingList(null);
        setListDialogOpen(true);
        setDrawerOpen(false);
      }}
      onEditList={(l) => {
        setEditingList(l);
        setListDialogOpen(true);
        setDrawerOpen(false);
      }}
      theme={theme}
      resolvedTheme={resolvedTheme}
      setTheme={setTheme}
      onSignOut={handleSignOut}
      canInstall={canInstall}
      onInstall={install}
    />
  );

  const searchInput = (
    <div className="relative w-full">
      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher une tâche…"
        aria-label="Rechercher une tâche"
        className="h-9 border-transparent bg-muted/60 pl-8 pr-8 focus-visible:border-input"
      />
      {search && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => setSearch("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Barre latérale (desktop) */}
      <aside className="hidden w-72 shrink-0 md:flex lg:w-80">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* En-tête */}
        <header className="safe-top z-10 flex items-center gap-2 border-b bg-background/90 px-3 py-2.5 backdrop-blur md:px-6">
          {/* Menu mobile */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              {sidebar}
            </SheetContent>
          </Sheet>

          <Logo className="size-8 md:hidden" />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight md:text-xl">
              {search.trim() ? "Recherche" : viewTitle}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {viewSubtitle}
            </p>
          </div>

          <SyncIndicator compact />
          <InstallButton className="hidden lg:inline-flex" />
        </header>

        {/* Recherche mobile */}
        <div className="border-b px-3 py-2 md:hidden">{searchInput}</div>

        {/* Contenu */}
        <main className="scrollbar-slim flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-3 px-3 pb-28 pt-4 md:px-6 md:pb-10">
            {/* Recherche desktop */}
            <div className="hidden md:block">{searchInput}</div>

            {/* Statistiques (desktop) */}
            {!search.trim() && (
              <div className="hidden flex-wrap gap-2 md:flex">
                <Badge variant="secondary" className="gap-1.5">
                  <ClipboardList className="size-3" />
                  {stats.all} en cours
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <CalendarCheck2 className="size-3 text-emerald-600" />
                  {stats.today} aujourd’hui
                </Badge>
                {stats.overdue > 0 && (
                  <Badge variant="destructive" className="gap-1.5">
                    {stats.overdue} en retard
                  </Badge>
                )}
                <Badge variant="secondary" className="gap-1.5">
                  <CheckCircle2 className="size-3 text-emerald-600" />
                  {stats.doneToday} terminée(s) aujourd’hui
                </Badge>
              </div>
            )}

            {/* Ajout rapide */}
            {!search.trim() &&
              !(view.type === "smart" && view.id === "completed") && (
                <QuickAdd
                  key={`${view.type}-${view.id}`}
                  lists={lists}
                  listName={view.type === "list" ? (activeList?.name ?? null) : null}
                  defaultToday={view.type === "smart" && view.id === "today"}
                  onSubmit={handleQuickAdd}
                />
              )}

            {/* Liste des tâches */}
            {tasksLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : visibleTasks.length === 0 ? (
              <EmptyState
                view={view}
                isSearch={!!search.trim()}
                searchQuery={search}
                overdue={stats.overdue}
                onAdd={openCreate}
              />
            ) : (
              <div className="space-y-2" role="list" aria-label="Tâches">
                {visibleTasks.map((task) => (
                  <div role="listitem" key={task.id}>
                    <TaskItem
                      task={task}
                      onToggle={handleToggle}
                      onToggleStar={handleToggleStar}
                      onEdit={openEdit}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Bouton flottant (mobile) */}
      <Button
        size="icon"
        onClick={openCreate}
        aria-label="Ajouter une tâche"
        className="fixed bottom-20 right-4 z-40 size-14 rounded-full shadow-lg md:hidden"
      >
        <Plus className="size-6" />
      </Button>

      {/* Navigation basse (mobile) */}
      <nav
        aria-label="Navigation principale"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur md:hidden"
      >
        {SMART_VIEWS.slice(0, 4).map((v) => {
          const active = view.type === "smart" && view.id === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => navigate({ type: "smart", id: v.id })}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <v.icon className={cn("size-5", active && "fill-primary/15")} />
              {v.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
            view.type === "list" ||
            (view.type === "smart" && view.id === "completed")
              ? "text-primary"
              : "text-muted-foreground"
          )}
        >
          <LayoutList className="size-5" />
          Listes
        </button>
      </nav>

      {/* Dialogues */}
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        defaults={taskDefaults}
        lists={lists}
        onCreate={(input) =>
          createTask.mutate({
            ...input,
            dueDate: input.dueDate ? input.dueDate.toISOString() : null,
          })
        }
        onUpdate={(id, data) =>
          updateTask.mutate({
            id,
            data: {
              ...data,
              dueDate:
                data.dueDate === undefined
                  ? undefined
                  : data.dueDate
                    ? data.dueDate.toISOString()
                    : null,
            },
          })
        }
        onDelete={(id) => {
          deleteTask.mutate(id);
          toast.success("Tâche supprimée");
        }}
      />

      <ListDialog
        open={listDialogOpen}
        onOpenChange={setListDialogOpen}
        list={editingList}
        onCreate={(input) =>
          createList.mutate(input, {
            onSuccess: () => toast.success("Liste créée"),
          })
        }
        onUpdate={(id, data) =>
          updateList.mutate({ id, data }, { onSuccess: () => toast.success("Liste mise à jour") })
        }
        onDelete={(id) => {
          deleteList.mutate(id);
          toast.success("Liste supprimée");
          if (view.type === "list" && view.id === id) {
            setView({ type: "smart", id: "all" });
          }
        }}
      />
    </div>
  );
}

/* ============================== Sous-composants ============================= */

interface Stats {
  today: number;
  upcoming: number;
  all: number;
  starred: number;
  completed: number;
  overdue: number;
  doneToday: number;
}

interface SidebarContentProps {
  view: View;
  onNavigate: (v: View) => void;
  lists: ListDto[];
  stats: Stats;
  user?: { name?: string | null; email?: string | null; image?: string | null };
  onAddList: () => void;
  onEditList: (list: ListDto) => void;
  theme?: string;
  resolvedTheme?: string;
  setTheme: (t: string) => void;
  onSignOut: () => void;
  canInstall: boolean;
  onInstall: () => void;
}

function SidebarContent({
  view,
  onNavigate,
  lists,
  stats,
  user,
  onAddList,
  onEditList,
  resolvedTheme,
  setTheme,
  onSignOut,
  canInstall,
  onInstall,
}: SidebarContentProps) {
  const countFor = (id: string) =>
    id === "today"
      ? stats.today
      : id === "upcoming"
        ? stats.upcoming
        : id === "all"
          ? stats.all
          : id === "starred"
            ? stats.starred
            : stats.completed;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
        <Logo className="size-9" />
        <div className="flex-1">
          <p className="font-bold leading-none">TaskSync</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Synchronisé via Google
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Changer de thème"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="size-4 dark:hidden" />
          <Moon className="hidden size-4 dark:block" />
        </Button>
      </div>

      <nav className="scrollbar-slim mt-2 flex-1 overflow-y-auto px-2 pb-2" aria-label="Vues">
        <div className="space-y-0.5">
          {SMART_VIEWS.map((v) => {
            const active = view.type === "smart" && view.id === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onNavigate({ type: "smart", id: v.id })}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-semibold text-primary"
                    : "text-foreground/80 hover:bg-accent"
                )}
                aria-current={active ? "page" : undefined}
              >
                <v.icon className={cn("size-4.5", active && "text-primary")} />
                {v.label}
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {countFor(v.id)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mb-1 mt-5 flex items-center justify-between px-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mes listes
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Créer une liste"
            onClick={onAddList}
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="space-y-0.5">
          {lists.map((l) => {
            const active = view.type === "list" && view.id === l.id;
            return (
              <div
                key={l.id}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  active ? "bg-accent font-semibold" : "hover:bg-accent"
                )}
              >
                <button
                  type="button"
                  onClick={() => onNavigate({ type: "list", id: l.id })}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="truncate">{l.name}</span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                    {l._count?.tasks ?? 0}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Modifier la liste ${l.name}`}
                  onClick={() => onEditList(l)}
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>
            );
          })}
          {lists.length === 0 && (
            <p className="px-2.5 py-1 text-xs text-muted-foreground">
              Aucune liste pour l’instant.
            </p>
          )}
        </div>
      </nav>

      <div className="border-t p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-accent"
            >
              <Avatar className="size-9">
                {user?.image && <AvatarImage src={user.image} alt="" />}
                <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                  {(user?.name?.[0] ?? user?.email?.[0] ?? "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight">
                  {user?.name ?? "Utilisateur"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-64">
            <DropdownMenuLabel className="truncate">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {canInstall && (
              <DropdownMenuItem onClick={onInstall}>
                <Download className="size-4" />
                Installer l’application
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
              {resolvedTheme === "dark" ? "Thème clair" : "Thème sombre"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="size-4" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function QuickAdd({
  lists,
  listName,
  defaultToday,
  onSubmit,
}: {
  lists: ListDto[];
  listName: string | null;
  defaultToday: boolean;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = React.useState("");

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 shadow-sm transition-colors focus-within:border-emerald-500/50">
      <Plus className="size-5 shrink-0 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={
          listName
            ? `Ajouter dans « ${listName} »…`
            : defaultToday
              ? "Ajouter pour aujourd’hui… (« rapport demain », « courses samedi #courses »)"
              : "Ajouter une tâche… (« rapport demain #travail »)"
        }
        aria-label="Ajout rapide de tâche"
        className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-8 shrink-0 text-xs text-primary hover:text-primary"
        onClick={submit}
        disabled={!value.trim()}
      >
        Ajouter
      </Button>
    </div>
  );
}

function EmptyState({
  view,
  isSearch,
  searchQuery,
  overdue,
  onAdd,
}: {
  view: View;
  isSearch: boolean;
  searchQuery: string;
  overdue: number;
  onAdd: () => void;
}) {
  if (isSearch) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
        <SearchX className="size-10 text-muted-foreground/50" />
        <div>
          <p className="font-medium">Aucun résultat</p>
          <p className="text-sm text-muted-foreground">
            Aucune tâche ne correspond à « {searchQuery} ».
          </p>
        </div>
      </div>
    );
  }

  const isToday = view.type === "smart" && view.id === "today";
  const isCompleted = view.type === "smart" && view.id === "completed";

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center">
      {isToday && overdue === 0 ? (
        <PartyPopper className="size-10 text-emerald-500/70" />
      ) : (
        <ClipboardList className="size-10 text-muted-foreground/50" />
      )}
      <div>
        <p className="font-medium">
          {isToday && overdue === 0
            ? "Tout est fait pour aujourd’hui !"
            : isCompleted
              ? "Aucune tâche terminée pour l’instant"
              : "Aucune tâche ici"}
        </p>
        <p className="text-sm text-muted-foreground">
          {isCompleted
            ? "Les tâches terminées apparaîtront ici."
            : "Ajoutez votre première tâche ci-dessus."}
        </p>
      </div>
      {!isCompleted && (
        <Button onClick={onAdd} className="gap-1.5">
          <Plus className="size-4" />
          Nouvelle tâche
        </Button>
      )}
    </div>
  );
}
