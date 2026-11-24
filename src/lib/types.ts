export interface TaskListRef {
  id: string;
  name: string;
  color: string;
}

export interface TaskPhaseRef {
  id: string;
  title: string;
}

export interface TaskDto {
  id: string;
  title: string;
  notes: string | null;
  completed: boolean;
  completedAt: string | null;
  priority: number;
  dueDate: string | null;
  starred: boolean;
  listId: string | null;
  list?: TaskListRef | null;
  phaseId: string | null;
  phase?: TaskPhaseRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListDto {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  _count?: { tasks: number };
  createdAt: string;
  updatedAt: string;
}

export interface PhaseDto {
  id: string;
  title: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type SmartView = "today" | "upcoming" | "all" | "starred" | "completed" | "phases";

export type View =
  | { type: "smart"; id: SmartView }
  | { type: "list"; id: string };
