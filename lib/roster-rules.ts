// Roster rules (pure, no data access): rest, consecutive days and weekly hours. They WARN, they never block.
// A limit of 0 switches that rule off. No runtime imports on purpose: tests run this file directly.

export interface RuleLimits {
  maxConsecutiveDays: number;
  minRestHours: number;
  maxWeeklyHours: number;
}

export interface RuleCode {
  type: "shift" | "leave";
  hours: number;
  start?: string; // HH:mm
  end?: string; // HH:mm, earlier than start = overnight
}

export interface RuleEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  code: string;
}

export type RuleKind = "consecutive" | "rest" | "weekly";

export interface RuleViolation {
  userId: string;
  date: string;
  rule: RuleKind;
  detail: string;
}

export const RULE_LABEL: Record<RuleKind, string> = { consecutive: "Days in a row", rest: "Rest between shifts", weekly: "Weekly hours" };

const parts = (date: string) => date.split("-").map(Number) as [number, number, number];
const dayNumber = (date: string) => {
  const [y, m, d] = parts(date);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};
const addDays = (date: string, n: number) => {
  const [y, m, d] = parts(date);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
};
const dow = (date: string) => {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const minutes = (t?: string) => (t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** First day of the week containing `date` (weekStart: 0 = Sunday, 1 = Monday). */
export const weekStartOf = (date: string, weekStart: 0 | 1) => addDays(date, -((dow(date) - weekStart + 7) % 7));

/**
 * Rule violations whose date falls in [from, to]. `entries` may include days before/after the window
 * (context for runs and weeks that cross the month edge); only violations dated in the window are returned.
 * Leave days and empty days break a run; only shift codes count as working.
 */
export function checkRoster(
  entries: readonly RuleEntry[],
  codes: ReadonlyMap<string, RuleCode>,
  limits: RuleLimits,
  weekStart: 0 | 1,
  window: { from: string; to: string },
): RuleViolation[] {
  const byUser = new Map<string, Map<string, RuleCode>>();
  for (const e of entries) {
    const c = codes.get(e.code);
    if (!c || c.type !== "shift") continue;
    let days = byUser.get(e.userId);
    if (!days) byUser.set(e.userId, (days = new Map()));
    days.set(e.date, c);
  }
  const inWindow = (d: string) => d >= window.from && d <= window.to;
  const out: RuleViolation[] = [];

  for (const [userId, days] of byUser) {
    const dates = [...days.keys()].sort();

    if (limits.maxConsecutiveDays > 0) {
      let run = 0;
      let runStart = "";
      const flush = () => {
        if (run > limits.maxConsecutiveDays) {
          const first = addDays(runStart, limits.maxConsecutiveDays); // the day that broke the limit
          if (inWindow(first)) {
            out.push({ userId, date: first, rule: "consecutive", detail: `${run} working days in a row (limit ${limits.maxConsecutiveDays})` });
          }
        }
      };
      let prev = "";
      for (const d of dates) {
        if (prev && dayNumber(d) === dayNumber(prev) + 1) run++;
        else {
          if (prev) flush();
          run = 1;
          runStart = d;
        }
        prev = d;
      }
      if (prev) flush();
    }

    if (limits.minRestHours > 0) {
      for (const d of dates) {
        const next = addDays(d, 1);
        const a = days.get(d)!, b = days.get(next);
        if (!b || !inWindow(next)) continue;
        const aStart = minutes(a.start), aEnd = minutes(a.end), bStart = minutes(b.start);
        if (aStart == null || aEnd == null || bStart == null) continue;
        const endAbs = aEnd <= aStart ? aEnd + 1440 : aEnd; // minutes from the start of day d
        const rest = (1440 + bStart - endAbs) / 60;
        if (rest < limits.minRestHours) {
          out.push({ userId, date: next, rule: "rest", detail: `${round1(rest)} h rest before the next shift (minimum ${limits.minRestHours} h)` });
        }
      }
    }

    if (limits.maxWeeklyHours > 0) {
      const weeks = new Map<string, number>();
      for (const d of dates) {
        const w = weekStartOf(d, weekStart);
        weeks.set(w, (weeks.get(w) ?? 0) + (days.get(d)!.hours || 0));
      }
      for (const [w, hours] of weeks) {
        const end = addDays(w, 6);
        if (hours <= limits.maxWeeklyHours || end < window.from || w > window.to) continue;
        out.push({ userId, date: w < window.from ? window.from : w, rule: "weekly", detail: `${round1(hours)} h in the week of ${w} (limit ${limits.maxWeeklyHours} h)` });
      }
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.userId.localeCompare(b.userId) || a.rule.localeCompare(b.rule)));
}
