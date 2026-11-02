import { loadUsers, getRoster, loadTeams } from "../../lib/actions";
import { toTeamOptions } from "../../lib/teams";
import { getShiftConfig } from "../../lib/shifts";
import { MONTH_RE, todayIn } from "../../lib/roster-dates";
import { toResources } from "../../lib/whereabouts";
import { getLocations } from "../../lib/settings";
import RosterClient from "./RosterClient";
import { viewer, viewerCan } from "../../lib/auth";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: requested } = await searchParams;
  const config = await getShiftConfig();
  const today = todayIn(config.timezone);
  const month = requested && MONTH_RE.test(requested) ? requested : today.slice(0, 7);

  const [{ users, error: usersError }, roster, locations, teamData, me] = await Promise.all([loadUsers(), getRoster(month), getLocations(), loadTeams(), viewer()]);
  const resources = toResources(users, locations);

  return <RosterClient resources={resources} entries={roster.entries} config={config} month={month} today={today} teams={toTeamOptions(teamData.teams, teamData.members)} loadError={roster.error || usersError || teamData.error} canEdit={viewerCan(me, "roster.edit")} canBulk={viewerCan(me, "roster.bulk")} />;
}
