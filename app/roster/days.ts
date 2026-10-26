import { dateOf, daysInMonth, weekday } from "../../lib/roster-dates.ts";

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_MID = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface MonthDay {
  d: number;
  date: string;
  /** "M" */
  short: string;
  /** "Mon" */
  mid: string;
  /** "Monday 5" */
  longLabel: string;
  weekend: boolean;
  isToday: boolean;
}

/** Every day of a month with its labels, computed once per month instead of once per cell per render. */
export function monthDays(month: string, today: string): MonthDay[] {
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const d = i + 1;
    const date = dateOf(month, d);
    const wd = weekday(date);
    return { d, date, short: WEEKDAY[wd], mid: WEEKDAY_MID[wd], longLabel: `${WEEKDAY_LONG[wd]} ${d}`, weekend: wd === 0 || wd === 6, isToday: date === today };
  });
}
