import { isRealDate, shiftDate } from "./roster-dates";
import type { ShiftConfig } from "./shifts";
import type { TaskConfig } from "./task-config";
import type { Availability, WorkTask } from "../app/tasks/types";
import type { RosterEntry } from "../app/roster/types";

export const MAX_WINDOW_DAYS = 120;

/** Inclusive list of dates in [start, end], capped at MAX_WINDOW_DAYS. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < MAX_WINDOW_DAYS; d = shiftDate(d, 1)) out.push(d);
  return out;
}

/** Months touched by a window, as YYYY-MM. */
export function monthsBetween(start: string, end: string): string[] {
  const months: string[] = [];
  for (const d of datesBetween(start, end)) if (!months.includes(d.slice(0, 7))) months.push(d.slice(0, 7));
  return months;
}

/** Task window from optional dates: both → [start,due]; one → that single day; none → null. */
export function taskWindow(start: string | null, due: string | null): [string, string] | null {
  const s = start && isRealDate(start) ? start : null;
  const d = due && isRealDate(due) ? due : null;
  if (s && d) return s <= d ? [s, d] : [d, s];
  if (s || d) return [(s ?? d)!, (s ?? d)!];
  return null;
}

/** Open story points / task count per user (subtasks count for their own assignee). */
export function workload(tasks: WorkTask[], config: TaskConfig, excludeId?: string) {
  const open = new Set(config.statuses.filter((s) => s.open).map((s) => s.key));
  const map = new Map<string, { points: number; tasks: number }>();
  for (const t of tasks) {
    if (!t.assigneeId || t.id === excludeId || !open.has(t.status)) continue;
    const cur = map.get(t.assigneeId) ?? { points: 0, tasks: 0 };
    map.set(t.assigneeId, { points: cur.points + (t.storyPoints ?? 0), tasks: cur.tasks + 1 });
  }
  return map;
}

/** Availability per user over the window. Warns (never blocks) on leave or no working days. */
export function availability(
  userIds: string[],
  window: [string, string] | null,
  roster: RosterEntry[],
  shifts: ShiftConfig,
  load: Map<string, { points: number; tasks: number }>
): Availability[] {
  const dates = window ? datesBetween(window[0], window[1]) : [];
  const inWindow = new Set(dates);
  const typeOf = new Map(shifts.codes.map((c) => [c.code, c.type]));
  const byUser = new Map<string, RosterEntry[]>();
  for (const e of roster) if (inWindow.has(e.date)) byUser.set(e.userId, [...(byUser.get(e.userId) ?? []), e]);

  return userIds.map((userId) => {
    const entries = byUser.get(userId) ?? [];
    const working = entries.filter((e) => typeOf.get(e.code) === "shift").length;
    const leaveCounts = new Map<string, number>();
    for (const e of entries) if (typeOf.get(e.code) === "leave") leaveCounts.set(e.code, (leaveCounts.get(e.code) ?? 0) + 1);
    const leave = [...leaveCounts].map(([code, days]) => ({ code, days }));
    const unscheduled = dates.length - entries.filter((e) => typeOf.has(e.code)).length;
    const l = load.get(userId) ?? { points: 0, tasks: 0 };

    let warning: string | null = null;
    if (dates.length) {
      if (leave.length) warning = `On leave ${leave.map((x) => `${x.code} ${x.days}d`).join(", ")} during this task`;
      else if (working === 0) warning = "Not rostered to work during this task";
    }
    return { userId, workingDays: working, leave, unscheduledDays: unscheduled, totalDays: dates.length, openPoints: l.points, openTasks: l.tasks, warning };
  });
}

