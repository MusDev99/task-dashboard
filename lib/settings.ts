// Readers for operational settings stored in their own tables. A missing table falls back to the
// seed defaults in json/, so the app works before `npm run migrate:settings` / first save.
import shiftDefaults from "../json/shifts.json";
import taskDefaults from "../json/task-config.json";
import { readTable, type Cell } from "./store";
import { bool, isMissingTab, num, text } from "./cells";
import { isCoverageDays, type CoverageTarget } from "./coverage";

export interface AppSettings {
  timezone: string;
  codePrefix: string;
  /** 0 = Sunday, 1 = Monday */
  weekStart: 0 | 1;
  maxLabels: number;
  maxLinks: number;
  /** Roster rules (warnings only). 0 switches a rule off. */
  maxConsecutiveDays: number;
  minRestHours: number;
  maxWeeklyHours: number;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string;
  active: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  timezone: shiftDefaults.timezone,
  codePrefix: taskDefaults.codePrefix,
  weekStart: 1,
  maxLabels: taskDefaults.maxLabels,
  maxLinks: taskDefaults.maxLinks,
  maxConsecutiveDays: 6,
  minRestHours: 11,
  maxWeeklyHours: 48,
};


/**
 * Rows of a settings tab, or null when the tab doesn't exist yet. STRICT: any other failure
 * (auth, network, quota) throws. Writers must use this one, so an outage is never mistaken for
 * "tab missing" and seeded over real data.
 */
export async function readSettingsTab(tab: string): Promise<Record<string, Cell>[] | null> {
  try {
    return await readTable(tab);
  } catch (e) {
    if (isMissingTab(e)) return null;
    throw e;
  }
}

/**
 * Tolerant variant for read-only getters: on any failure it logs and returns null, so pages fall back
 * to the JSON defaults and show their own "couldn't load" banner instead of crashing the whole route.
 */
export async function readSettingsTabSafe(tab: string): Promise<Record<string, Cell>[] | null> {
  try {
    return await readSettingsTab(tab);
  } catch (e) {
    console.error(`Settings tab "${tab}" could not be read; using defaults:`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await readSettingsTabSafe("app_settings");
  if (!rows) return DEFAULT_APP_SETTINGS;
  const map = new Map(rows.map((r) => [text(r.key), r.value]));
  const tz = text(map.get("timezone") ?? "");
  return {
    timezone: tz || DEFAULT_APP_SETTINGS.timezone,
    codePrefix: text(map.get("codePrefix") ?? "") || DEFAULT_APP_SETTINGS.codePrefix,
    weekStart: num(map.get("weekStart") ?? "", DEFAULT_APP_SETTINGS.weekStart) === 0 ? 0 : 1,
    maxLabels: num(map.get("maxLabels") ?? "", DEFAULT_APP_SETTINGS.maxLabels),
    maxLinks: num(map.get("maxLinks") ?? "", DEFAULT_APP_SETTINGS.maxLinks),
    maxConsecutiveDays: num(map.get("maxConsecutiveDays") ?? "", DEFAULT_APP_SETTINGS.maxConsecutiveDays),
    minRestHours: num(map.get("minRestHours") ?? "", DEFAULT_APP_SETTINGS.minRestHours),
    maxWeeklyHours: num(map.get("maxWeeklyHours") ?? "", DEFAULT_APP_SETTINGS.maxWeeklyHours),
  };
}

export async function getLocations(): Promise<Location[]> {
  const rows = (await readSettingsTabSafe("locations")) ?? [];
  return rows
    .map((r) => ({ id: text(r.id), code: text(r.code), name: text(r.name), type: text(r.type) || "other", address: text(r.address), active: bool(r.active, true) }))
    .filter((l) => l.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Coverage targets (none until the first one is added). Tolerant read: an outage shows no targets, not an error page. */
export async function getCoverageTargets(): Promise<CoverageTarget[]> {
  const rows = (await readSettingsTabSafe("coverage_targets")) ?? [];
  return rows
    .map((r) => ({ id: text(r.id), locationId: text(r.locationId), code: text(r.code).toUpperCase(), days: isCoverageDays(text(r.days)) ? (text(r.days) as CoverageTarget["days"]) : "every", minStaff: num(r.minStaff), active: bool(r.active, true) }))
    .filter((t) => t.id && t.code && t.minStaff > 0);
}

export async function getRoles(): Promise<Role[]> {
  const rows = (await readSettingsTabSafe("roles")) ?? [];
  return rows
    .map((r) => ({ id: text(r.id), name: text(r.name), description: text(r.description), active: bool(r.active, true) }))
    .filter((r) => r.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

