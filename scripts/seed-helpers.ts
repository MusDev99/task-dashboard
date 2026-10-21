// Shared by migrate-settings.ts and migrate-to-sheets.ts. Plain Node (no Next), so JSON is read from disk.
import { readFileSync } from "node:fs";
import { appendRow, ensureTab, readTable, writeTable, type Cell } from "../lib/googleSheets.ts";
import {
  APP_SETTING_COLUMNS, LOCATION_COLUMNS, ROLE_COLUMNS, ROSTER_CODE_COLUMNS, STORY_POINT_COLUMNS, TASK_STATUS_COLUMNS,
} from "../lib/schema.ts";

const json = (name: string) => JSON.parse(readFileSync(new URL(`../json/${name}.json`, import.meta.url), "utf-8"));

async function rowsOrNull(tab: string): Promise<Record<string, Cell>[] | null> {
  try {
    return await readTable(tab);
  } catch (e) {
    if (String(e).includes("Unable to parse range")) return null;
    throw e;
  }
}

/** Write defaults into a settings tab only if it's missing or empty. Returns true if it seeded. */
async function seed(tab: string, headers: readonly string[], records: Record<string, Cell>[]): Promise<boolean> {
  const rows = await rowsOrNull(tab);
  if (rows && rows.length) return false;
  await ensureTab(tab, headers);
  await writeTable(tab, [...headers], records.map((r) => headers.map((h) => r[h] ?? "")));
  return true;
}

export async function seedDefaults(): Promise<string[]> {
  const shifts = json("shifts");
  const tasks = json("task-config");
  const seeded: string[] = [];
  const codes = shifts.codes.map((c: Record<string, Cell>, i: number) => ({ ...c, start: c.start ?? "", end: c.end ?? "", paid: true, active: true, sortOrder: (i + 1) * 10 }));
  if (await seed("roster_codes", ROSTER_CODE_COLUMNS, codes)) seeded.push("roster_codes");
  const statuses = tasks.statuses.map((s: Record<string, Cell>, i: number) => ({ ...s, isDefault: i === 0, isDone: s.key === "completed", active: true, sortOrder: (i + 1) * 10 }));
  if (await seed("task_statuses", TASK_STATUS_COLUMNS, statuses)) seeded.push("task_statuses");
  const points = tasks.storyPoints.map((p: Record<string, Cell>) => ({ ...p, active: true }));
  if (await seed("story_points", STORY_POINT_COLUMNS, points)) seeded.push("story_points");
  const general = [
    { key: "timezone", value: shifts.timezone },
    { key: "codePrefix", value: tasks.codePrefix },
    { key: "weekStart", value: 1 },
    { key: "maxLabels", value: tasks.maxLabels },
    { key: "maxLinks", value: tasks.maxLinks },
  ];
  if (await seed("app_settings", APP_SETTING_COLUMNS, general)) seeded.push("app_settings");
  return seeded;
}

/** Make sure a location exists for each code (matched case-insensitively). Returns code → location id. */
export async function ensureLocations(codes: string[]): Promise<{ map: Map<string, string>; created: number }> {
  await ensureTab("locations", LOCATION_COLUMNS);
  const existing = (await rowsOrNull("locations")) ?? [];
  const map = new Map(existing.map((l) => [String(l.code).toUpperCase(), String(l.id)]));
  let created = 0;
  for (const raw of new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))) {
    if (map.has(raw)) continue;
    const id = crypto.randomUUID();
    await appendRow("locations", LOCATION_COLUMNS, { id, code: raw, name: raw, type: "station", address: "", active: true });
    map.set(raw, id);
    created++;
  }
  return { map, created };
}

/** Make sure a role exists for each id in use (keeps the id; placeholder name to rename in Settings). */
export async function ensureRoles(ids: string[]): Promise<number> {
  await ensureTab("roles", ROLE_COLUMNS);
  const existing = (await rowsOrNull("roles")) ?? [];
  const known = new Set(existing.map((r) => String(r.id)));
  let n = existing.length;
  let created = 0;
  for (const id of new Set(ids.filter(Boolean))) {
    if (known.has(id)) continue;
    n++;
    await appendRow("roles", ROLE_COLUMNS, { id, name: `Role ${n}`, description: `Migrated from role id ${id.slice(0, 8)}…`, active: true });
    created++;
  }
  return created;
}
