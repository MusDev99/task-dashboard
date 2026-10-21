import type { Cell } from "./googleSheets";

// Small, forgiving converters for sheet cells (people may hand-edit the sheet).
export const text = (v: Cell): string => (v == null ? "" : String(v).trim());
export const optText = (v: Cell): string | null => text(v) || null;
export const num = (v: Cell, fallback = 0): number => {
  const n = Number(v);
  return v === "" || v == null || !Number.isFinite(n) ? fallback : n;
};
/** TRUE/true/1/yes → true; empty → `fallback`. */
export const bool = (v: Cell, fallback = false): boolean => {
  if (v === "" || v == null) return fallback;
  if (typeof v === "boolean") return v;
  return ["true", "1", "yes", "y"].includes(String(v).trim().toLowerCase());
};

/** True when Sheets says the tab doesn't exist yet. */
export const isMissingTab = (e: unknown) => String(e).includes("Unable to parse range");
