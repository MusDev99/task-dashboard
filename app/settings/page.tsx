import { getShiftConfig } from "../../lib/shifts";
import { getTaskConfig } from "../../lib/task-config";
import { getAppSettings, getLocations, getRoles, DEFAULT_APP_SETTINGS } from "../../lib/settings";
import { getUsageCounts } from "../../lib/settings-actions";
import type { EntityKind, SettingRecord } from "../../lib/settings-validation";
import SettingsClient from "./SettingsClient";

// Settings live in Google Sheets; always render per request.
export const dynamic = "force-dynamic";

const empty: Record<EntityKind, Record<string, number>> = { shift: {}, leave: {}, location: {}, role: {}, status: {}, point: {} };

export default async function SettingsPage() {
  try {
    const [shifts, tasks, locations, roles, general, usage] = await Promise.all([
      getShiftConfig(), getTaskConfig(), getLocations(), getRoles(), getAppSettings(), getUsageCounts(),
    ]);
    const codes = shifts.codes.map((c) => ({ ...c, start: c.start ?? "", end: c.end ?? "" }));
    const records: Record<EntityKind, SettingRecord[]> = {
      shift: codes.filter((c) => c.type === "shift"),
      leave: codes.filter((c) => c.type === "leave"),
      location: locations.map((l) => ({ ...l })),
      role: roles.map((r) => ({ ...r })),
      status: tasks.statuses.map((s) => ({ ...s })),
      point: tasks.storyPoints.map((p) => ({ ...p })),
    };
    return <SettingsClient general={general} records={records} usage={usage} loadError={false} />;
  } catch (e) {
    console.error("Error loading settings:", e);
    const records = { shift: [], leave: [], location: [], role: [], status: [], point: [] };
    return <SettingsClient general={DEFAULT_APP_SETTINGS} records={records} usage={empty} loadError />;
  }
}
