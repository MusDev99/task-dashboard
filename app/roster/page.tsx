import { loadUsers, getRoster } from "../../lib/actions";
import { getShiftConfig } from "../../lib/shifts";
import { MONTH_RE, todayIn } from "../../lib/roster-dates";
import { toResources } from "../../lib/whereabouts";
import { getLocations } from "../../lib/settings";
import RosterClient from "./RosterClient";

// Data comes from Google Sheets; always render per request.
export const dynamic = "force-dynamic";

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: requested } = await searchParams;
  const config = await getShiftConfig();
  const today = todayIn(config.timezone);
  const month = requested && MONTH_RE.test(requested) ? requested : today.slice(0, 7);

  const [{ users, error: usersError }, roster, locations] = await Promise.all([loadUsers(), getRoster(month), getLocations()]);
  const resources = toResources(users, locations);

  return <RosterClient resources={resources} entries={roster.entries} config={config} month={month} today={today} loadError={roster.error || usersError} />;
}
