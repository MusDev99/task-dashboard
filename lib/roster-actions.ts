"use server";

import { revalidatePath } from "next/cache";
import { ensureTab, upsertRowsById, deleteRowsByIds, readTable } from "./googleSheets";
import { getUsers, getRoster } from "./actions";
import { getShiftConfig } from "./shifts";
import { ROSTER_COLUMNS } from "./schema";
import { rosterId, isRealDate } from "./roster-dates";
import { validateCells, validMonth } from "./roster-validation";
import type { ActionResult } from "./user-actions";
import type { CellRef, RosterEntry } from "../app/roster/types";
import { requireSession } from "./auth";

const nowStamp = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const refresh = () => {
  revalidatePath("/roster");
  revalidatePath("/"); // dashboard whereabouts
};
const fail = (e: unknown): { ok: false; message: string } => {
  console.error(e);
  return { ok: false, message: "Couldn't reach Google Sheets. Please try again." };
};

async function context() {
  const [users, config] = await Promise.all([getUsers(), getShiftConfig()]);
  await ensureTab("roster", ROSTER_COLUMNS);
  return { userIds: new Set(users.map((u) => u.id)), users, config };
}

/** Assign one shift/leave code to the given cells (one row per user per day: existing rows are overwritten). */
export async function setCells(cells: CellRef[], code: string): Promise<ActionResult<{ count: number }>> {
  await requireSession();
  try {
    const { userIds, config } = await context();
    const error = validateCells(cells, userIds, config, code);
    if (error) return { ok: false, message: error };

    const type = config.codes.find((c) => c.code === code)!.type;
    const stamp = nowStamp();
    const unique = new Map(cells.map((c) => [rosterId(c.userId, c.date), c]));
    await upsertRowsById(
      "roster",
      ROSTER_COLUMNS,
      [...unique].map(([id, c]) => ({ id, userId: c.userId, date: c.date, type, code, updatedAt: stamp }))
    );
    refresh();
    return { ok: true, data: { count: unique.size } };
  } catch (e) {
    return fail(e);
  }
}

/** Remove the roster rows for the given cells (empty cell = no row). */
export async function clearCells(cells: CellRef[]): Promise<ActionResult<{ count: number }>> {
  await requireSession();
  try {
    const { userIds, config } = await context();
    const error = validateCells(cells, userIds, config);
    if (error) return { ok: false, message: error };
    const count = await deleteRowsByIds("roster", cells.map((c) => rosterId(c.userId, c.date)));
    refresh();
    return { ok: true, data: { count } };
  } catch (e) {
    return fail(e);
  }
}

/** Bulk clear: every roster row of the given users within one month. */
export async function clearSchedule(userIds: string[], month: string): Promise<ActionResult<{ count: number }>> {
  await requireSession();
  try {
    if (!validMonth(month)) return { ok: false, message: "Invalid month." };
    if (!Array.isArray(userIds) || userIds.length === 0) return { ok: false, message: "Select at least one resource." };
    await ensureTab("roster", ROSTER_COLUMNS);
    const wanted = new Set(userIds);
    const rows = await readTable("roster");
    const ids = rows.filter((r) => wanted.has(String(r.userId)) && String(r.date).startsWith(month)).map((r) => String(r.id));
    const count = await deleteRowsByIds("roster", ids);
    refresh();
    return { ok: true, data: { count } };
  } catch (e) {
    return fail(e);
  }
}

export interface ImportRow {
  email?: string;
  employeeId?: string;
  date: string;
  code: string;
}
export interface ImportError {
  row: number; // 1-based data row (excluding header)
  message: string;
}

/** Resolve and validate CSV rows. With `apply=false` it only reports what would happen. */
export async function importRoster(rows: ImportRow[], apply: boolean): Promise<ActionResult<{ count: number; errors: ImportError[] }>> {
  await requireSession();
  try {
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, message: "The file has no data rows." };
    if (rows.length > 5000) return { ok: false, message: "Too many rows (max 5,000)." };
    const { users, config } = await context();
    const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    const byEmp = new Map(users.filter((u) => u.employeeId).map((u) => [String(u.employeeId).toLowerCase(), u]));

    const errors: ImportError[] = [];
    const records = new Map<string, Record<string, string>>();
    const stamp = nowStamp();
    rows.forEach((r, i) => {
      const n = i + 1;
      const user = (r.email && byEmail.get(r.email.trim().toLowerCase())) || (r.employeeId && byEmp.get(r.employeeId.trim().toLowerCase())) || null;
      const code = (r.code ?? "").trim().toUpperCase();
      const date = (r.date ?? "").trim();
      const def = config.codes.find((c) => c.code === code && c.active);
      if (!user) errors.push({ row: n, message: "Unknown resource (email / employee ID not found)" });
      else if (!isRealDate(date)) errors.push({ row: n, message: `Invalid date "${date}" (use YYYY-MM-DD)` });
      else if (!def) errors.push({ row: n, message: `Unknown code "${r.code}"` });
      else records.set(rosterId(user.id, date), { id: rosterId(user.id, date), userId: user.id, date, type: def.type, code, updatedAt: stamp });
    });

    if (errors.length || !apply) return { ok: true, data: { count: records.size, errors } };
    await upsertRowsById("roster", ROSTER_COLUMNS, [...records.values()]);
    refresh();
    return { ok: true, data: { count: records.size, errors: [] } };
  } catch (e) {
    return fail(e);
  }
}


/** Read-only: one month of roster entries (used by the dashboard when stepping across months). */
export async function fetchRosterMonth(month: string): Promise<{ entries: RosterEntry[]; error: boolean }> {
  await requireSession();
  if (!validMonth(month)) return { entries: [], error: true };
  return getRoster(month);
}
