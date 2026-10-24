import defaults from "../json/task-config.json";
import { bool, num, text } from "./cells";
import { getAppSettings, readSettingsTabSafe } from "./settings";

export interface TaskStatus {
  key: string;
  label: string;
  color: string;
  /** Open statuses count toward a person's workload. */
  open: boolean;
  /** New tasks start here. Exactly one. */
  isDefault: boolean;
  /** Ticking a subtask moves it here. Exactly one. */
  isDone: boolean;
  active: boolean;
  sortOrder: number;
}

export interface StoryPoint {
  value: number;
  complexity: string;
  label: string;
  active: boolean;
}

export interface TaskConfig {
  codePrefix: string;
  statuses: TaskStatus[];
  storyPoints: StoryPoint[];
  maxLabels: number;
  maxLinks: number;
  weekStart: 0 | 1;
}

export const DEFAULT_TASK_STATUSES: TaskStatus[] = defaults.statuses.map((s, i) => ({
  ...s,
  isDefault: i === 0,
  isDone: s.key === "completed",
  active: true,
  sortOrder: (i + 1) * 10,
}));
export const DEFAULT_STORY_POINTS: StoryPoint[] = defaults.storyPoints.map((p) => ({ ...p, active: true }));

/** Statuses, story points and limits from their tabs (JSON defaults until they exist). */
export async function getTaskConfig(): Promise<TaskConfig> {
  const [settings, statusRows, pointRows] = await Promise.all([getAppSettings(), readSettingsTabSafe("task_statuses"), readSettingsTabSafe("story_points")]);
  let statuses: TaskStatus[] = statusRows
    ? statusRows
        .map((r) => ({
          key: text(r.key),
          label: text(r.label) || text(r.key),
          color: text(r.color) || "#8b8da3",
          open: bool(r.open, true),
          isDefault: bool(r.isDefault),
          isDone: bool(r.isDone),
          active: bool(r.active, true),
          sortOrder: num(r.sortOrder, 999),
        }))
        .filter((s) => s.key)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : DEFAULT_TASK_STATUSES;
  if (statuses.length === 0) statuses = DEFAULT_TASK_STATUSES;
  // Guarantee a default + done status even if the data was hand-edited.
  if (!statuses.some((s) => s.isDefault)) statuses = statuses.map((s, i) => ({ ...s, isDefault: i === 0 }));
  if (!statuses.some((s) => s.isDone)) statuses = statuses.map((s) => ({ ...s, isDone: s.key === (statuses.find((x) => !x.open) ?? statuses[statuses.length - 1]).key }));

  const storyPoints: StoryPoint[] = pointRows
    ? pointRows
        .map((r) => ({ value: num(r.value, NaN), complexity: text(r.complexity), label: text(r.label), active: bool(r.active, true) }))
        .filter((p) => Number.isFinite(p.value))
        .sort((a, b) => a.value - b.value)
    : DEFAULT_STORY_POINTS;

  return { codePrefix: settings.codePrefix, statuses, storyPoints, maxLabels: settings.maxLabels, maxLinks: settings.maxLinks, weekStart: settings.weekStart };
}

export { defaultStatus, doneStatus } from "./task-status";
