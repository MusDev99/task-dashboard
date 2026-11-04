"use server";

import { revalidatePath } from "next/cache";
import { appendRow, deleteRowsMatching, ensureTab, readTable, updateRowByKey, writeTable, type Cell } from "./store";
import { getShiftConfig, DEFAULT_ROSTER_CODES } from "./shifts";
import { getTaskConfig, DEFAULT_TASK_STATUSES, DEFAULT_STORY_POINTS } from "./task-config";
import { getCoverageTargets, getLocations, getRoles, readSettingsTab } from "./settings";
import { APP_SETTING_COLUMNS } from "./schema";
import { isMissingTab } from "./cells";
import { actorWith, requireSession } from "./auth";
import { recordAudit } from "./audit-log";
import {
  SPECS, cleanEntity, keyOf, validateCoverageRefs, validateEntity, validateGeneral,
  type EntityKind, type GeneralInput, type SettingErrors, type SettingRecord,
} from "./settings-validation";

export type SettingsResult = { ok: true; message: string } | { ok: false; errors?: SettingErrors; message?: string };

function refresh() {
  for (const p of ["/settings", "/roster", "/tasks", "/users", "/"]) revalidatePath(p);
}
const fail = (e: unknown): { ok: false; message: string } => {
  console.error(e);
  return { ok: false, message: "Couldn't save right now. Please try again." };
};
const asRow = (r: SettingRecord) => r as Record<string, Cell>;

/** Current records of an entity's tab (JSON defaults while the tab doesn't exist). */
async function currentRecords(kind: EntityKind): Promise<SettingRecord[]> {
  switch (kind) {
    case "shift":
    case "leave":
      return (await getShiftConfig()).codes.map((c) => ({ ...c, start: c.start ?? "", end: c.end ?? "" }));
    case "location":
      return (await getLocations()).map((l) => ({ ...l }));
    case "role":
      return (await getRoles()).map((r) => ({ ...r }));
    case "status":
      return (await getTaskConfig()).statuses.map((s) => ({ ...s }));
    case "point":
      return (await getTaskConfig()).storyPoints.map((p) => ({ ...p }));
    case "coverage":
      return (await getCoverageTargets()).map((t) => ({ ...t }));
  }
}

/** Before the first write to a tab, create it and copy the defaults in, so nothing the app was using disappears. */
async function seedIfMissing(kind: EntityKind) {
  const { tab, headers } = SPECS[kind];
  if ((await readSettingsTab(tab)) !== null) return;
  await ensureTab(tab, headers);
  const defaults: SettingRecord[] =
    tab === "roster_codes" ? DEFAULT_ROSTER_CODES.map((c) => ({ ...c, start: c.start ?? "", end: c.end ?? "" }))
    : tab === "task_statuses" ? DEFAULT_TASK_STATUSES.map((s) => ({ ...s }))
    : tab === "story_points" ? DEFAULT_STORY_POINTS.map((p) => ({ ...p }))
    : [];
  if (defaults.length) await writeTable(tab, [...headers], defaults.map((d) => headers.map((h) => (d[h] ?? "") as Cell)));
}

/** How many rows reference each key, per entity (shown as "In use" and used to block deletes). */
export async function getUsageCounts(): Promise<Record<EntityKind, Record<string, number>>> {
  await requireSession();
  const read = async (tab: string) => {
    try {
      return await readTable(tab);
    } catch (e) {
      if (isMissingTab(e)) return [];
      throw e;
    }
  };
  const [roster, users, tasks] = await Promise.all([read("roster"), read("users"), read("work_tasks")]);
  const count = (rows: Record<string, Cell>[], col: string) => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const v = r[col] == null ? "" : String(r[col]);
      if (v) m[v] = (m[v] ?? 0) + 1;
    }
    return m;
  };
  const codes = count(roster, "code");
  return { shift: codes, leave: codes, location: count(users, "locationId"), role: count(users, "roleId"), status: count(tasks, "status"), point: count(tasks, "storyPoints"), coverage: {} };
}

/** "3 roster days", "1 person", "2 tasks" */
function usageText(kind: EntityKind, n: number): string {
  if (kind === "shift" || kind === "leave") return `${n} roster day${n === 1 ? "" : "s"}`;
  if (kind === "location" || kind === "role") return n === 1 ? "1 person" : `${n} people`;
  if (kind === "coverage") return `${n} target${n === 1 ? "" : "s"}`;
  return `${n} task${n === 1 ? "" : "s"}`;
}

/** Short name for toasts and the audit log. */
function nameOf(kind: EntityKind, r: SettingRecord): string {
  if (kind === "coverage") return `${r.code} ≥ ${r.minStaff}`;
  return String(r.label || r.name || r.code || r.value);
}

export async function saveSetting(kind: EntityKind, originalKey: string | null, raw: Record<string, unknown>): Promise<SettingsResult> {
  const { actor, denied } = await actorWith("settings.edit", "saveSetting");
  if (denied) return denied;
  try {
    const spec = SPECS[kind];
    const existing = await currentRecords(kind);
    const record = cleanEntity(kind, raw);
    if (originalKey) {
      // Keys are immutable: an edit can never move a record to a different code/key/value.
      if (!existing.some((x) => keyOf(kind, x) === originalKey)) return { ok: false, message: `This ${spec.noun} no longer exists.` };
      record[spec.keyField] = kind === "point" ? Number(originalKey) : originalKey;
    } else if (kind === "location" || kind === "role" || kind === "coverage") {
      record.id = crypto.randomUUID();
    }
    const errors = validateEntity(kind, record, existing, originalKey);
    if (kind === "coverage" && !Object.keys(errors).length) {
      const [shifts, locations] = await Promise.all([getShiftConfig(), getLocations()]);
      const previous = originalKey ? existing.find((x) => keyOf(kind, x) === originalKey) ?? null : null;
      Object.assign(errors, validateCoverageRefs(record, shifts.codes.filter((c) => c.type === "shift"), locations, previous));
    }
    if (Object.keys(errors).length) return { ok: false, errors };

    await seedIfMissing(kind);
    // Exactly one default and one done status: picking a new one switches the old one off.
    if (kind === "status") {
      for (const flag of ["isDefault", "isDone"] as const) {
        if (!record[flag]) continue;
        for (const other of existing.filter((x) => x[flag] && keyOf(kind, x) !== originalKey)) {
          await updateRowByKey(spec.tab, spec.headers, spec.keyField, keyOf(kind, other), asRow({ ...other, [flag]: false }));
        }
      }
    }
    if (originalKey) await updateRowByKey(spec.tab, spec.headers, spec.keyField, originalKey, asRow(record));
    else await appendRow(spec.tab, spec.headers, asRow(record));
    const name = nameOf(kind, record);
    await recordAudit(actor, { action: originalKey ? "update" : "create", entity: "setting", entityId: `${kind}:${keyOf(kind, record)}`, summary: `${originalKey ? "Saved" : "Added"} ${spec.noun} “${name}”` });
    refresh();
    return { ok: true, message: `${originalKey ? "Saved" : "Added"} ${spec.noun} “${name}”` };
  } catch (e) {
    return fail(e);
  }
}

export async function setSettingActive(kind: EntityKind, key: string, active: boolean): Promise<SettingsResult> {
  const { denied } = await actorWith("settings.edit", "setSettingActive");
  if (denied) return denied;
  const record = (await currentRecords(kind)).find((x) => keyOf(kind, x) === key);
  if (!record) return { ok: false, message: `This ${SPECS[kind].noun} no longer exists.` };
  const res = await saveSetting(kind, key, { ...record, active });
  if (!res.ok) return res.errors ? { ok: false, message: Object.values(res.errors)[0] } : res;
  return { ok: true, message: `${active ? "Activated" : "Deactivated"} ${SPECS[kind].noun} “${nameOf(kind, record)}”` };
}

export async function deleteSetting(kind: EntityKind, key: string): Promise<SettingsResult> {
  const { actor, denied } = await actorWith("settings.edit", "deleteSetting");
  if (denied) return denied;
  try {
    const spec = SPECS[kind];
    const existing = await currentRecords(kind);
    const record = existing.find((x) => keyOf(kind, x) === key);
    if (!record) return { ok: false, message: `This ${spec.noun} no longer exists.` };
    const used = (await getUsageCounts())[kind][key] ?? 0;
    if (used > 0) return { ok: false, message: `Can't delete: used by ${usageText(kind, used)}. Deactivate it instead.` };
    if (kind === "status") {
      if (record.isDefault || record.isDone) return { ok: false, message: "Can't delete the default or done status. Pick another one first." };
      if (!existing.some((x) => x.key !== key && x.active && x.open)) return { ok: false, message: "At least one active status must count as open." };
    }
    if (kind === "point" && existing.length <= 1) return { ok: false, message: "Keep at least one story-point value." };
    await seedIfMissing(kind);
    // Coverage targets point at shifts and locations: remove them first so none is left dangling.
    let removedTargets = 0;
    if ((kind === "shift" || kind === "location") && (await readSettingsTab("coverage_targets")) !== null) {
      const column = kind === "shift" ? "code" : "locationId";
      const ids = (await getCoverageTargets()).filter((t) => t[column] === key).map((t) => t.id);
      removedTargets = ids.length ? await deleteRowsMatching("coverage_targets", "id", new Set(ids)) : 0;
    }
    await deleteRowsMatching(spec.tab, spec.keyField, new Set([key]));
    await recordAudit(actor, { action: "delete", entity: "setting", entityId: `${kind}:${key}`, summary: `Deleted ${spec.noun} “${nameOf(kind, record)}”${removedTargets ? ` and ${removedTargets} coverage target${removedTargets === 1 ? "" : "s"}` : ""}` });
    refresh();
    return { ok: true, message: `Deleted ${spec.noun} “${nameOf(kind, record)}”` };
  } catch (e) {
    return fail(e);
  }
}

export async function saveGeneral(raw: Record<string, unknown>): Promise<SettingsResult> {
  const { actor, denied } = await actorWith("settings.edit", "saveGeneral");
  if (denied) return denied;
  try {
    const g: GeneralInput = {
      timezone: String(raw.timezone ?? "").trim(),
      codePrefix: String(raw.codePrefix ?? "").trim().toUpperCase(),
      weekStart: Number(raw.weekStart),
      maxLabels: Number(raw.maxLabels),
      maxLinks: Number(raw.maxLinks),
      maxConsecutiveDays: Number(raw.maxConsecutiveDays),
      minRestHours: Number(raw.minRestHours),
      maxWeeklyHours: Number(raw.maxWeeklyHours),
    };
    const errors = validateGeneral(g);
    if (Object.keys(errors).length) return { ok: false, errors };
    await ensureTab("app_settings", APP_SETTING_COLUMNS);
    await writeTable("app_settings", [...APP_SETTING_COLUMNS], Object.entries(g).map(([k, v]) => [k, v]));
    await recordAudit(actor, { action: "update", entity: "setting", entityId: "general", summary: "Saved general settings" });
    refresh();
    return { ok: true, message: "Saved general settings" };
  } catch (e) {
    return fail(e);
  }
}
