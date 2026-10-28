"use server";

import { revalidatePath } from "next/cache";
import { appendRow, deleteRowsByIds, ensureTab, updateRowById } from "./store";
import { getUsers, loadWorkTasks } from "./actions";
import { loadAssigneeData } from "./assignee-data";
import { getTaskConfig } from "./task-config";
import { WORK_TASK_COLUMNS } from "./schema";
import { cleanTaskInput, validateTask, type TaskErrors } from "./task-validation";
import type { Availability, TaskInput, WorkTask } from "../app/tasks/types";
import type { Cell } from "./store";
import { requireSession } from "./auth";

export type TaskResult<T> = { ok: true; data: T } | { ok: false; errors?: TaskErrors; message?: string };

const nowStamp = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const refresh = () => {
  revalidatePath("/tasks");
  revalidatePath("/");
};
const fail = (e: unknown): { ok: false; message: string } => {
  console.error(e);
  return { ok: false, message: "Couldn't save right now. Please try again." };
};

const toRow = (t: WorkTask): Record<string, Cell> => ({
  ...t,
  labels: JSON.stringify(t.labels),
  links: JSON.stringify(t.links),
});

async function context() {
  await ensureTab("work_tasks", WORK_TASK_COLUMNS);
  const [users, config, loaded] = await Promise.all([getUsers(), getTaskConfig(), loadWorkTasks()]);
  if (loaded.error) throw new Error("work_tasks could not be loaded");
  return { users, config, tasks: loaded.tasks };
}

function nextCode(tasks: WorkTask[], prefix: string): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const max = tasks.reduce((m, t) => Math.max(m, Number(t.code.match(re)?.[1] ?? 0)), 0);
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export async function createTask(raw: Partial<TaskInput>): Promise<TaskResult<WorkTask>> {
  await requireSession();
  try {
    const { users, config, tasks } = await context();
    const input = cleanTaskInput(raw, config);
    const errors = validateTask(input, config, users, tasks);
    if (Object.keys(errors).length) return { ok: false, errors };
    const stamp = nowStamp();
    const task: WorkTask = { ...input, id: crypto.randomUUID(), code: nextCode(tasks, config.codePrefix), createdAt: stamp, updatedAt: stamp };
    await appendRow("work_tasks", WORK_TASK_COLUMNS, toRow(task));
    refresh();
    return { ok: true, data: task };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTask(id: string, raw: Partial<TaskInput>): Promise<TaskResult<WorkTask>> {
  await requireSession();
  try {
    const { users, config, tasks } = await context();
    const current = tasks.find((t) => t.id === id);
    if (!current) return { ok: false, message: "This task no longer exists." };
    // A task's level is fixed once created: never move tasks in or out of a parent here.
    const input = { ...cleanTaskInput(raw, config), parentId: current.parentId };
    const errors = validateTask(input, config, users, tasks, id);
    if (Object.keys(errors).length) return { ok: false, errors };
    const task: WorkTask = { ...current, ...input, updatedAt: nowStamp() };
    const found = await updateRowById("work_tasks", WORK_TASK_COLUMNS, id, toRow(task));
    if (!found) return { ok: false, message: "This task no longer exists." };
    refresh();
    return { ok: true, data: task };
  } catch (e) {
    return fail(e);
  }
}

export async function setTaskStatus(id: string, status: string): Promise<TaskResult<WorkTask>> {
  await requireSession();
  try {
    const { config, tasks } = await context();
    const current = tasks.find((t) => t.id === id);
    if (!current) return { ok: false, message: "This task no longer exists." };
    const def = config.statuses.find((s) => s.key === status);
    if (!def || (!def.active && current.status !== status)) return { ok: false, message: "That status isn't available." };
    const task: WorkTask = { ...current, status, updatedAt: nowStamp() };
    await updateRowById("work_tasks", WORK_TASK_COLUMNS, id, toRow(task));
    refresh();
    return { ok: true, data: task };
  } catch (e) {
    return fail(e);
  }
}

/** Deletes a task and its subtasks (subtasks first, so none is ever orphaned). */
export async function deleteTask(id: string): Promise<TaskResult<{ subtasksDeleted: number }>> {
  await requireSession();
  try {
    const { tasks } = await context();
    if (!tasks.some((t) => t.id === id)) return { ok: false, message: "This task no longer exists." };
    const subIds = tasks.filter((t) => t.parentId === id).map((t) => t.id);
    const subtasksDeleted = await deleteRowsByIds("work_tasks", subIds);
    await deleteRowsByIds("work_tasks", [id]);
    refresh();
    return { ok: true, data: { subtasksDeleted } };
  } catch (e) {
    return fail(e);
  }
}

/** Read-only: availability + workload of every active user for a task window (dates optional). */
export async function getAssigneeAvailability(start: string | null, due: string | null, excludeTaskId?: string): Promise<Availability[]> {
  await requireSession();
  return (await loadAssigneeData(start, due, excludeTaskId)).list;
}
