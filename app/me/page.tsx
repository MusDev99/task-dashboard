import { getRoster, loadWorkTasks } from "../../lib/actions";
import { getShiftConfig } from "../../lib/shifts";
import { getTaskConfig } from "../../lib/task-config";
import { todayIn } from "../../lib/roster-dates";
import { viewer } from "../../lib/auth";
import { buildDays, monthsOf, myOpenTasks, summarize } from "../../lib/my-schedule";
import MyScheduleClient from "./MyScheduleClient";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";
export const metadata = { title: "My schedule · WorkForce Management" };

export default async function MySchedulePage() {
  const [me, shifts, config] = await Promise.all([viewer(), getShiftConfig(), getTaskConfig()]);
  const today = todayIn(shifts.timezone);
  // Only the signed-in person's own rows are ever shown (uid from the session, never from the URL).
  const uid = me?.uid ?? "";
  const skeleton = buildDays([], uid, shifts.codes, today, config.weekStart);
  const [rosters, loaded] = await Promise.all([Promise.all(monthsOf(skeleton).map((m) => getRoster(m))), loadWorkTasks()]);
  const days = buildDays(rosters.flatMap((r) => r.entries), uid, shifts.codes, today, config.weekStart);

  return (
    <MyScheduleClient
      days={days}
      summary={summarize(days)}
      tasks={myOpenTasks(loaded.tasks, uid, config, today)}
      config={config}
      today={today}
      signedIn={!!uid}
      loadError={loaded.error || rosters.some((r) => r.error)}
    />
  );
}
