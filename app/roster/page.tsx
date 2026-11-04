import { loadUsers, getRoster, loadTeams } from "../../lib/actions";
import { toTeamOptions } from "../../lib/teams";
import { ledUserIds, rosterScoped } from "../../lib/access";
import { getShiftConfig } from "../../lib/shifts";
import { MONTH_RE, shiftMonth, todayIn } from "../../lib/roster-dates";
import { toResources } from "../../lib/whereabouts";
import { getAppSettings, getCoverageTargets, getLocations } from "../../lib/settings";
import RosterClient from "./RosterClient";
import { viewer, viewerCan } from "../../lib/auth";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: requested } = await searchParams;
  const config = await getShiftConfig();
  const today = todayIn(config.timezone);
  const month = requested && MONTH_RE.test(requested) ? requested : today.slice(0, 7);

  // The neighbouring months are context only (runs of days and weeks cross month edges); they are never shown or edited.
  const [{ users, error: usersError }, roster, locations, teamData, me, targets, settings, before, after] = await Promise.all([
    loadUsers(), getRoster(month), getLocations(), loadTeams(), viewer(), getCoverageTargets(), getAppSettings(), getRoster(shiftMonth(month, -1)), getRoster(shiftMonth(month, 1)),
  ]);
  const resources = toResources(users, locations);

  return <RosterClient resources={resources} entries={roster.entries} config={config} month={month} today={today} teams={toTeamOptions(teamData.teams, teamData.members)} loadError={roster.error || usersError || teamData.error} canEdit={viewerCan(me, "roster.edit")}
    editableIds={me && rosterScoped(me.level) ? [...ledUserIds(me.uid, teamData.teams, teamData.members)] : null} canBulk={viewerCan(me, "roster.bulk")}
    targets={targets} locationNames={Object.fromEntries(locations.map((l) => [l.id, l.name]))} contextEntries={[...before.entries, ...after.entries]} weekStart={settings.weekStart}
    limits={{ maxConsecutiveDays: settings.maxConsecutiveDays, minRestHours: settings.minRestHours, maxWeeklyHours: settings.maxWeeklyHours }} />;
}
