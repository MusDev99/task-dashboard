import { loadUsers, getRoster } from "../lib/actions";
import { getShiftConfig } from "../lib/shifts";
import { isRealDate, todayIn } from "../lib/roster-dates";
import { toResources } from "../lib/whereabouts";
import { getLocations } from "../lib/settings";
import WhereaboutsSection from "./whereabouts/WhereaboutsSection";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: requested } = await searchParams;
  const config = await getShiftConfig();
  const today = todayIn(config.timezone);
  const date = requested && isRealDate(requested) ? requested : today;
  const [{ users, error: usersError }, roster, locations] = await Promise.all([loadUsers(), getRoster(date.slice(0, 7)), getLocations()]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Who is working, on leave or unscheduled today.</p>
        </div>
      </div>

      {/* Daily Whereabouts (derived from the roster) */}
      <WhereaboutsSection
        resources={toResources(users, locations)}
        entries={roster.entries}
        config={config}
        initialDate={date}
        today={today}
        loadError={roster.error || usersError}
      />
    </div>
  );
}
