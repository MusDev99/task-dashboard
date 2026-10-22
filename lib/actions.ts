import { readTable, type Cell } from "./store";
import { USER_COLUMNS, TASK_COLUMNS, WORK_TASK_COLUMNS } from "./schema";
import type { User, TaskCompletion, Difficulty } from "../app/lib/types";
import type { RosterEntry } from "../app/roster/types";
import type { WorkTask, TaskLink } from "../app/tasks/types";
import { MONTH_RE } from "./roster-dates";

// Tables: "users" and "tasks" (see lib/schema.ts).

const str = (v: Cell): string | null => (v == null || v === "" ? null : String(v));
const bool = (v: Cell): boolean => v === true || String(v).toUpperCase() === "TRUE";
const num = (v: Cell): number => Number(v) || 0;

function toUser(r: Record<string, Cell>): User {
  return {
    id: String(r.id),
    email: String(r.email ?? ""),
    name: String(r.name ?? ""),
    employeeId: str(r.employeeId),
    googleId: str(r.googleId),
    isActive: bool(r.isActive),
    joinedDate: String(r.joinedDate ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
    phoneNumber: str(r.phoneNumber),
    roleId: str(r.roleId),
    avatar: str(r.avatar),
    locationId: str(r.locationId),
  };
}

function toTask(r: Record<string, Cell>): TaskCompletion {
  return {
    id: String(r.id),
    userId: String(r.userId),
    taskTitle: String(r.taskTitle ?? ""),
    difficulty: String(r.difficulty ?? "easy").toLowerCase() as Difficulty,
    correctness: num(r.correctness),
    timeTakenSeconds: num(r.timeTakenSeconds),
    maxTimeSeconds: num(r.maxTimeSeconds),
    completedAt: String(r.completedAt ?? ""),
  };
}

/** Fails loudly if a tab's header row was edited, instead of silently producing rows with undefined ids. */
function assertColumns(tab: string, rows: Record<string, Cell>[], columns: readonly string[]) {
  if (rows.length === 0) return;
  const missing = columns.filter((c) => !(c in rows[0]));
  if (missing.length) {
    const hint = tab === "users" && missing.includes("locationId") && "stationCode" in rows[0] ? " Run `npm run migrate:settings`." : "";
    throw new Error(`Tab "${tab}": header row is missing column(s) ${missing.map((m) => `"${m}"`).join(", ")}. Expected: ${columns.join(", ")}.${hint}`);
  }
}

async function readUsers(): Promise<User[]> {
  const rows = await readTable("users");
  assertColumns("users", rows, USER_COLUMNS);
  return rows.map(toUser);
}

async function readTasks(): Promise<TaskCompletion[]> {
  const rows = await readTable("tasks");
  assertColumns("tasks", rows, TASK_COLUMNS);
  return rows.map(toTask);
}

export async function getUsers(): Promise<User[]> {
  try {
    return await readUsers();
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export async function getTasks(): Promise<TaskCompletion[]> {
  try {
    return await readTasks();
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}

export async function getTaskById(id: string): Promise<TaskCompletion | null> {
  return (await getTasks()).find((t) => t.id === id) ?? null;
}

export async function getUserById(
  id: string
): Promise<(User & { tasks: TaskCompletion[] }) | null> {
  const [users, tasks] = await Promise.all([getUsers(), getTasks()]);
  const user = users.find((u) => u.id === id);
  return user ? { ...user, tasks: tasks.filter((t) => t.userId === id) } : null;
}

/** Users + tasks for admin screens. Unlike getUsers/getTasks it reports failures, so the UI can say so instead of showing an empty list. */
export async function loadDirectory(): Promise<{ users: User[]; tasks: TaskCompletion[]; error: boolean }> {
  try {
    const [users, tasks] = await Promise.all([readUsers(), readTasks()]);
    return { users, tasks, error: false };
  } catch (error) {
    console.error("Error loading directory:", error);
    return { users: [], tasks: [], error: true };
  }
}

function toRosterEntry(r: Record<string, Cell>): RosterEntry {
  return {
    id: String(r.id),
    userId: String(r.userId),
    date: String(r.date),
    type: r.type === "leave" ? "leave" : "shift",
    code: String(r.code ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

/** Roster entries for one month ("YYYY-MM"). The tab is created lazily on first write, so a missing tab reads as empty. */
export async function getRoster(month: string): Promise<{ entries: RosterEntry[]; error: boolean }> {
  if (!MONTH_RE.test(month)) return { entries: [], error: false };
  try {
    const rows = await readTable("roster");
    return { entries: rows.map(toRosterEntry).filter((e) => e.date.startsWith(month)), error: false };
  } catch (error) {
    // A table that hasn't been created yet answers 400 "Unable to parse range": treat that as empty.
    if (String(error).includes("Unable to parse range")) return { entries: [], error: false };
    console.error("Error fetching roster:", error);
    return { entries: [], error: true };
  }
}

/** Users with a load-failure flag (see loadDirectory). */
export async function loadUsers(): Promise<{ users: User[]; error: boolean }> {
  try {
    return { users: await readUsers(), error: false };
  } catch (error) {
    console.error("Error loading users:", error);
    return { users: [], error: true };
  }
}

// ─── Work tasks ─────────────────────────────────────────────────────────────

function parseJson<T>(v: Cell, fallback: T): T {
  if (v == null || v === "") return fallback;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
}

function toWorkTask(r: Record<string, Cell>): WorkTask {
  const pts = r.storyPoints == null || r.storyPoints === "" ? null : Number(r.storyPoints);
  return {
    id: String(r.id),
    code: String(r.code ?? ""),
    parentId: str(r.parentId),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    status: String(r.status ?? "todo"),
    storyPoints: pts != null && Number.isFinite(pts) ? pts : null,
    assigneeId: str(r.assigneeId),
    labels: parseJson<string[]>(r.labels, []).filter((l) => typeof l === "string"),
    links: parseJson<TaskLink[]>(r.links, []).filter((l) => l && typeof l.url === "string"),
    startDate: str(r.startDate),
    dueDate: str(r.dueDate),
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

/** All work tasks + subtasks. The tab is created on first write, so a missing tab reads as empty. */
export async function loadWorkTasks(): Promise<{ tasks: WorkTask[]; error: boolean }> {
  try {
    const rows = await readTable("work_tasks");
    assertColumns("work_tasks", rows, WORK_TASK_COLUMNS);
    return { tasks: rows.map(toWorkTask), error: false };
  } catch (error) {
    if (String(error).includes("Unable to parse range")) return { tasks: [], error: false };
    console.error("Error loading work tasks:", error);
    return { tasks: [], error: true };
  }
}
