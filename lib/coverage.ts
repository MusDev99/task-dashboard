// Coverage targets (pure, no data access): "at least N people on shift X at location Y on these days".
// No runtime imports on purpose: tests run this file directly with `node --test`.

export const COVERAGE_DAYS = ["every", "weekdays", "weekends"] as const;
export type CoverageDays = (typeof COVERAGE_DAYS)[number];
export const COVERAGE_DAYS_LABEL: Record<CoverageDays, string> = { every: "Every day", weekdays: "Mon–Fri", weekends: "Sat–Sun" };

export interface CoverageTarget {
  id: string;
  /** "" = everyone, whatever their location. */
  locationId: string;
  code: string;
  days: CoverageDays;
  minStaff: number;
  active: boolean;
}

export interface CoveragePerson {
  id: string;
  locationId: string | null;
  isActive: boolean;
}

export interface CoverageEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  code: string;
}

export interface CoverageGap {
  targetId: string;
  date: string;
  code: string;
  locationId: string;
  have: number;
  need: number;
}

export const isCoverageDays = (v: unknown): v is CoverageDays => (COVERAGE_DAYS as readonly string[]).includes(String(v));

/** 0 = Sunday … 6 = Saturday (calendar maths only, no time zones). */
const dow = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export function appliesOn(days: CoverageDays, date: string): boolean {
  if (days === "every") return true;
  const weekend = dow(date) === 0 || dow(date) === 6;
  return days === "weekends" ? weekend : !weekend;
}

/**
 * Days where fewer people than a target's minimum are rostered on its shift code. Only active people count
 * (and, for a location target, only people at that location). Targets that are inactive are ignored.
 * Sorted by date, then code.
 */
export function computeCoverage(
  dates: readonly string[],
  targets: readonly CoverageTarget[],
  people: readonly CoveragePerson[],
  entries: readonly CoverageEntry[],
): CoverageGap[] {
  const byDayCode = new Map<string, string[]>();
  for (const e of entries) {
    const k = `${e.date}|${e.code}`;
    const list = byDayCode.get(k);
    if (list) list.push(e.userId);
    else byDayCode.set(k, [e.userId]);
  }
  const gaps: CoverageGap[] = [];
  for (const t of targets) {
    if (!t.active || !(t.minStaff > 0)) continue;
    const eligible = new Set(people.filter((p) => p.isActive && (!t.locationId || p.locationId === t.locationId)).map((p) => p.id));
    for (const date of dates) {
      if (!appliesOn(t.days, date)) continue;
      const have = (byDayCode.get(`${date}|${t.code}`) ?? []).filter((id) => eligible.has(id)).length;
      if (have < t.minStaff) gaps.push({ targetId: t.id, date, code: t.code, locationId: t.locationId, have, need: t.minStaff });
    }
  }
  return gaps.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.code.localeCompare(b.code) || a.locationId.localeCompare(b.locationId)));
}

type Rec = Record<string, string | number | boolean>;
type Errors = Record<string, string>;

/** Field-level checks for one coverage target. `others` = the other targets (to refuse duplicates). */
export function validateCoverageRecord(r: Rec, others: readonly Rec[]): Errors {
  const e: Errors = {};
  const min = Number(r.minStaff);
  if (!Number.isInteger(min) || min < 1 || min > 999) e.minStaff = "Use a whole number from 1 to 999";
  if (!String(r.code)) e.code = "Pick a shift";
  if (!isCoverageDays(r.days)) e.days = `Choose one of: ${COVERAGE_DAYS.join(", ")}`;
  else if (String(r.code) && others.some((x) => x.code === r.code && x.locationId === r.locationId && x.days === r.days)) e.code = "A target for this shift, location and days already exists";
  return e;
}

/** Server-side check that a target points at a real, active shift and (if set) an active location. An existing target keeps working if its shift or location is later deactivated. */
export function validateCoverageRefs(
  r: Rec,
  shifts: readonly { code: string; active: boolean }[],
  locations: readonly { id: string; active: boolean }[],
  previous: Rec | null,
): Errors {
  const e: Errors = {};
  const shift = shifts.find((x) => x.code === r.code);
  if (!shift) e.code = "Pick one of the work shifts";
  else if (!shift.active && previous?.code !== r.code) e.code = "This shift is inactive";
  const loc = String(r.locationId);
  if (loc) {
    const found = locations.find((x) => x.id === loc);
    if (!found) e.locationId = "Pick one of the locations";
    else if (!found.active && previous?.locationId !== loc) e.locationId = "This location is inactive";
  }
  return e;
}
