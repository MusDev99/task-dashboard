import { isRealDate, MONTH_RE, monthOf } from "./roster-dates";
import type { ShiftConfig } from "./shifts";
import type { CellRef } from "../app/roster/types";

export const MAX_CELLS = 2000;

/** Returns an error message, or null when the cells/code are acceptable. */
export function validateCells(cells: CellRef[], userIds: Set<string>, config: ShiftConfig, code?: string): string | null {
  if (!Array.isArray(cells) || cells.length === 0) return "No cells selected.";
  if (cells.length > MAX_CELLS) return `Too many cells at once (max ${MAX_CELLS}).`;
  if (code !== undefined && !config.codes.some((c) => c.code === code && c.active)) return `Unknown or inactive shift/leave code "${code}".`;
  for (const c of cells) {
    if (!userIds.has(c.userId)) return "One of the selected resources no longer exists.";
    if (!isRealDate(c.date)) return `Invalid date "${c.date}".`;
  }
  return null;
}

export const validMonth = (m: string) => MONTH_RE.test(m);
export { monthOf };
