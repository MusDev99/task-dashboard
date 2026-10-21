import { isRealDate } from "./roster-dates";
import { safeUrl } from "./links";
import { defaultStatus } from "./task-status";
import type { TaskConfig } from "./task-config";
import type { TaskInput, WorkTask } from "../app/tasks/types";
import type { User } from "../app/lib/types";

export type TaskField = "title" | "description" | "status" | "storyPoints" | "assigneeId" | "labels" | "links" | "startDate" | "dueDate" | "parentId";
export type TaskErrors = Partial<Record<TaskField, string>>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Trim/normalise whatever the client sent (be liberal in what we accept). */
export function cleanTaskInput(raw: Partial<TaskInput>, config: TaskConfig): TaskInput {
  const seen = new Set<string>();
  const labels = (Array.isArray(raw.labels) ? raw.labels : [])
    .map((l) => str(l).replace(/\s+/g, " "))
    .filter((l) => l && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase()));
  const links = (Array.isArray(raw.links) ? raw.links : [])
    .map((l) => ({ url: str(l?.url), label: str(l?.label) }))
    .filter((l) => l.url);
  const points = raw.storyPoints == null || String(raw.storyPoints) === "" ? null : Number(raw.storyPoints);
  return {
    parentId: str(raw.parentId) || null,
    title: str(raw.title),
    description: str(raw.description),
    status: str(raw.status) || defaultStatus(config),
    storyPoints: points,
    assigneeId: str(raw.assigneeId) || null,
    labels,
    links,
    startDate: str(raw.startDate) || null,
    dueDate: str(raw.dueDate) || null,
  };
}

/** Validates cleaned input against config, users and existing tasks. `selfId` = task being edited. */
export function validateTask(input: TaskInput, config: TaskConfig, users: Pick<User, "id" | "isActive">[], tasks: WorkTask[], selfId?: string): TaskErrors {
  const e: TaskErrors = {};
  if (!input.title) e.title = "Title is required";
  else if (input.title.length > 120) e.title = "Title must be 120 characters or fewer";
  if (input.description.length > 2000) e.description = "Description must be 2,000 characters or fewer";
  // Inactive statuses/points can't be newly chosen, but a task may keep the one it already has.
  const current = tasks.find((t) => t.id === selfId);
  const status = config.statuses.find((s) => s.key === input.status);
  if (!status || (!status.active && current?.status !== input.status)) e.status = "Pick an active status";
  if (input.storyPoints != null) {
    const p = config.storyPoints.find((x) => x.value === input.storyPoints);
    if (!p || (!p.active && current?.storyPoints !== input.storyPoints)) e.storyPoints = "Pick a value from the scale";
  }
  if (input.assigneeId) {
    const u = users.find((x) => x.id === input.assigneeId);
    if (!u) e.assigneeId = "This person no longer exists";
    else if (!u.isActive && tasks.find((t) => t.id === selfId)?.assigneeId !== u.id) e.assigneeId = "This person is inactive";
  }
  if (input.startDate && !isRealDate(input.startDate)) e.startDate = "Invalid date";
  if (input.dueDate && !isRealDate(input.dueDate)) e.dueDate = "Invalid date";
  if (!e.startDate && !e.dueDate && input.startDate && input.dueDate && input.dueDate < input.startDate) e.dueDate = "Due date can't be before the start date";
  if (input.labels.length > config.maxLabels) e.labels = `At most ${config.maxLabels} labels`;
  else if (input.labels.some((l) => l.length > 24)) e.labels = "Labels must be 24 characters or fewer";
  if (input.links.length > config.maxLinks) e.links = `At most ${config.maxLinks} links`;
  else if (input.links.some((l) => !safeUrl(l.url))) e.links = "Links must be valid http(s) URLs";
  else if (input.links.some((l) => l.label.length > 60)) e.links = "Link labels must be 60 characters or fewer";
  if (input.parentId) {
    const parent = tasks.find((t) => t.id === input.parentId);
    if (!parent) e.parentId = "The parent task no longer exists";
    else if (parent.parentId) e.parentId = "Subtasks can't have their own subtasks";
    else if (parent.id === selfId) e.parentId = "A task can't be its own subtask";
    else if (selfId && tasks.some((t) => t.parentId === selfId)) e.parentId = "A task with subtasks can't become a subtask";
  }
  return e;
}
