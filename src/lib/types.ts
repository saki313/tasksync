export interface TaskListRef {
  id: string;
  name: string;
  color: string;
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

export type SmartView = "today" | "upcoming" | "all" | "starred" | "completed";

export type View =
  | { type: "smart"; id: SmartView }
  | { type: "list"; id: string };
