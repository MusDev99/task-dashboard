// My schedule (pure, no data access): one person's next days and open tasks. Unit-tested.
import { shiftDate, weekday } from "./roster-dates.ts";
import type { ShiftCode } from "./shifts";
import type { TaskConfig } from "./task-config";
import type { RosterEntry } from "../app/roster/types";
import type { WorkTask } from "../app/tasks/types";

export const SCHEDULE_DAYS = 14;

export interface ScheduleDay {
  date: string;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  weekend: boolean;
  isToday: boolean;
  /** Empty = no roster row that day (not scheduled). */
  code: string;
  def: ShiftCode | null;
  /** First day of a new week (by the org's week start), or the first day shown: a week header goes above it. */
  weekBreak: boolean;
}

export interface ScheduleSummary {
  workingDays: number;
  hours: number;
  leaveDays: number;
  unscheduledDays: number;
}

/**
 * `n` days from `today` for one person. Only `uid`'s entries are used, so a caller passing the whole roster
 * can never leak someone else's day.
 */
export function buildDays(entries: readonly RosterEntry[], uid: string, codes: readonly ShiftCode[], today: string, weekStart: 0 | 1, n = SCHEDULE_DAYS): ScheduleDay[] {
  const mine = new Map(entries.filter((e) => e.userId === uid).map((e) => [e.date, e.code]));
  const byCode = new Map(codes.map((c) => [c.code, c]));
  return Array.from({ length: n }, (_, i) => {
    const date = shiftDate(today, i);
    const wd = weekday(date);
    const code = mine.get(date) ?? "";
    return { date, weekday: wd, weekend: wd === 0 || wd === 6, isToday: i === 0, code, def: byCode.get(code) ?? null, weekBreak: i === 0 || wd === weekStart };
  });
}

export function summarize(days: readonly ScheduleDay[]): ScheduleSummary {
  const s: ScheduleSummary = { workingDays: 0, hours: 0, leaveDays: 0, unscheduledDays: 0 };
  for (const d of days) {
    if (!d.code) s.unscheduledDays++;
    else if (d.def?.type === "leave") s.leaveDays++;
    else if (d.def?.type === "shift") {
      // A zero-hour shift code (e.g. an off day) is scheduled but not a working day.
      if (d.def.hours > 0) s.workingDays++;
      s.hours += d.def.hours;
    }
  }
  return s;
}

export interface MyTask {
  task: WorkTask;
  /** Subtasks: the parent's title, for context. */
  parentTitle: string | null;
  overdue: boolean;
}

/** Open tasks and subtasks assigned to `uid`: overdue first, then by due date, then undated (by code). */
export function myOpenTasks(tasks: readonly WorkTask[], uid: string, config: TaskConfig, today: string): MyTask[] {
  if (!uid) return [];
  const open = new Map(config.statuses.map((s) => [s.key, s.open]));
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  return tasks
    .filter((t) => t.assigneeId === uid && (open.get(t.status) ?? true))
    .map((t) => ({ task: t, parentTitle: t.parentId ? titles.get(t.parentId) ?? null : null, overdue: !!t.dueDate && t.dueDate < today }))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const da = a.task.dueDate ?? "9999-99-99";
      const db = b.task.dueDate ?? "9999-99-99";
      return da === db ? a.task.code.localeCompare(b.task.code) : da.localeCompare(db);
    });
}

/** The months a day range touches (14 days can span two). */
export function monthsOf(days: readonly { date: string }[]): string[] {
  return [...new Set(days.map((d) => d.date.slice(0, 7)))];
}
