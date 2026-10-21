export interface TaskLink {
  url: string;
  label: string;
}

export interface WorkTask {
  id: string;
  code: string;
  parentId: string | null;
  title: string;
  description: string;
  status: string;
  storyPoints: number | null;
  assigneeId: string | null;
  labels: string[];
  links: TaskLink[];
  startDate: string | null; // YYYY-MM-DD
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the drawer sends to the server (the server fills id/code/timestamps). */
export interface TaskInput {
  parentId: string | null;
  title: string;
  description: string;
  status: string;
  storyPoints: number | null;
  assigneeId: string | null;
  labels: string[];
  links: TaskLink[];
  startDate: string | null;
  dueDate: string | null;
}

/** Per-person availability over a task window (see lib/capacity.ts). */
export interface Availability {
  userId: string;
  workingDays: number;
  leave: { code: string; days: number }[];
  unscheduledDays: number;
  totalDays: number;
  openPoints: number;
  openTasks: number;
  warning: string | null;
}

/** Minimal person record the task UI needs (includes inactive users so old assignees still display). */
export interface Person {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  avatar: string | null;
  isActive: boolean;
}
