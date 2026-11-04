import { getShiftConfig } from "../../lib/shifts";
import { getTaskConfig } from "../../lib/task-config";
import { getAppSettings, getCoverageTargets, getLocations, getRoles, DEFAULT_APP_SETTINGS } from "../../lib/settings";
import { getUsageCounts } from "../../lib/settings-actions";
import type { EntityKind, SettingRecord } from "../../lib/settings-validation";
import SettingsClient from "./SettingsClient";
import NoAccess from "../components/NoAccess";
import { viewer, viewerCan } from "../../lib/auth";

// Settings are read fresh on every request.
export const dynamic = "force-dynamic";

const empty: Record<EntityKind, Record<string, number>> = { shift: {}, leave: {}, location: {}, role: {}, status: {}, point: {}, coverage: {} };

export default async function SettingsPage() {
  const me = await viewer();
  if (!viewerCan(me, "settings.view")) return <NoAccess what="Settings" />;
  const readOnly = !viewerCan(me, "settings.edit");
  try {
    const [shifts, tasks, locations, roles, general, usage, coverage] = await Promise.all([
      getShiftConfig(), getTaskConfig(), getLocations(), getRoles(), getAppSettings(), getUsageCounts(), getCoverageTargets(),
    ]);
    const codes = shifts.codes.map((c) => ({ ...c, start: c.start ?? "", end: c.end ?? "" }));
    const records: Record<EntityKind, SettingRecord[]> = {
      shift: codes.filter((c) => c.type === "shift"),
      leave: codes.filter((c) => c.type === "leave"),
      location: locations.map((l) => ({ ...l })),
      role: roles.map((r) => ({ ...r })),
      status: tasks.statuses.map((s) => ({ ...s })),
      point: tasks.storyPoints.map((p) => ({ ...p })),
      coverage: coverage.map((t) => ({ ...t })),
    };
    return <SettingsClient general={general} records={records} usage={usage} loadError={false} readOnly={readOnly} />;
  } catch (e) {
    console.error("Error loading settings:", e);
    const records = { shift: [], leave: [], location: [], role: [], status: [], point: [], coverage: [] };
    return <SettingsClient general={DEFAULT_APP_SETTINGS} records={records} usage={empty} loadError readOnly={readOnly} />;
  }
}
