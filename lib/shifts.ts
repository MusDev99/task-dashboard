import defaults from "../json/shifts.json";
import { bool, num, optText, text } from "./cells";
import { getAppSettings, readSettingsTab } from "./settings";

export interface ShiftCode {
  code: string;
  label: string;
  type: "shift" | "leave";
  hours: number;
  start?: string;
  end?: string;
  color: string;
  /** Leave only: paid or unpaid. */
  paid: boolean;
  /** Inactive codes still render where used, but can't be picked. */
  active: boolean;
  sortOrder: number;
}

export interface ShiftConfig {
  timezone: string;
  codes: ShiftCode[];
}

type Seed = { code: string; label: string; type: string; hours: number; start?: string; end?: string; color: string };

export const DEFAULT_ROSTER_CODES: ShiftCode[] = (defaults.codes as Seed[]).map((c, i) => ({
  ...c,
  type: c.type === "leave" ? "leave" : "shift",
  paid: true,
  active: true,
  sortOrder: (i + 1) * 10,
}));

/** Shift + leave codes from the `roster_codes` tab (JSON defaults until it exists) and the org timezone. */
export async function getShiftConfig(): Promise<ShiftConfig> {
  const [settings, rows] = await Promise.all([getAppSettings(), readSettingsTab("roster_codes")]);
  const codes: ShiftCode[] = rows
    ? rows
        .map((r) => ({
          code: text(r.code).toUpperCase(),
          type: (text(r.type) === "leave" ? "leave" : "shift") as ShiftCode["type"],
          label: text(r.label) || text(r.code),
          start: optText(r.start) ?? undefined,
          end: optText(r.end) ?? undefined,
          hours: num(r.hours),
          color: text(r.color) || "#8b8da3",
          paid: bool(r.paid, true),
          active: bool(r.active, true),
          sortOrder: num(r.sortOrder, 999),
        }))
        .filter((c) => c.code)
    : DEFAULT_ROSTER_CODES;
  return { timezone: settings.timezone, codes: [...codes].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)) };
}
