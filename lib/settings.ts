// Readers for operational settings stored in sheet tabs. A missing tab falls back to the
// seed defaults in json/, so the app works before `npm run migrate:settings` / first save.
import shiftDefaults from "../json/shifts.json";
import taskDefaults from "../json/task-config.json";
import { readTable, type Cell } from "./googleSheets";
import { bool, isMissingTab, num, text } from "./cells";

export interface AppSettings {
  timezone: string;
  codePrefix: string;
  /** 0 = Sunday, 1 = Monday */
  weekStart: 0 | 1;
  maxLabels: number;
  maxLinks: number;
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
};


/** Rows of a settings tab, or null when the tab doesn't exist yet (caller uses defaults). */
export async function readSettingsTab(tab: string): Promise<Record<string, Cell>[] | null> {
  try {
    return await readTable(tab);
  } catch (e) {
    if (isMissingTab(e)) return null;
    throw e;
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await readSettingsTab("app_settings");
  if (!rows) return DEFAULT_APP_SETTINGS;
  const map = new Map(rows.map((r) => [text(r.key), r.value]));
  const tz = text(map.get("timezone") ?? "");
  return {
    timezone: tz || DEFAULT_APP_SETTINGS.timezone,
    codePrefix: text(map.get("codePrefix") ?? "") || DEFAULT_APP_SETTINGS.codePrefix,
    weekStart: num(map.get("weekStart") ?? "", DEFAULT_APP_SETTINGS.weekStart) === 0 ? 0 : 1,
    maxLabels: num(map.get("maxLabels") ?? "", DEFAULT_APP_SETTINGS.maxLabels),
    maxLinks: num(map.get("maxLinks") ?? "", DEFAULT_APP_SETTINGS.maxLinks),
  };
}

export async function getLocations(): Promise<Location[]> {
  const rows = (await readSettingsTab("locations")) ?? [];
  return rows
    .map((r) => ({ id: text(r.id), code: text(r.code), name: text(r.name), type: text(r.type) || "other", address: text(r.address), active: bool(r.active, true) }))
    .filter((l) => l.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getRoles(): Promise<Role[]> {
  const rows = (await readSettingsTab("roles")) ?? [];
  return rows
    .map((r) => ({ id: text(r.id), name: text(r.name), description: text(r.description), active: bool(r.active, true) }))
    .filter((r) => r.id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

