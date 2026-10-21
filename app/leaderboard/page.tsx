import { getTasks, getUsers } from "../../lib/actions";
import { getLocations } from "../../lib/settings";
import { calculateMeritScore, calculateAvgCorrectness } from "../lib/merit";
import LeaderboardClient from "./LeaderboardClient";

// Data comes from Google Sheets; always render per request.
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [users, tasks, locations] = await Promise.all([getUsers(), getTasks(), getLocations()]);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));

  const leaderboard = users
    .map((user) => {
      const userTasks = tasks.filter((t) => t.userId === user.id);
      return {
        user,
        locationName: user.locationId ? locationName.get(user.locationId) ?? null : null,
        meritScore: calculateMeritScore(userTasks),
        tasksCompleted: userTasks.length,
        avgCorrectness: calculateAvgCorrectness(userTasks),
        rank: 0,
      };
    })
    .sort((a, b) => b.meritScore - a.meritScore)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return <LeaderboardClient initialLeaderboard={leaderboard} />;
}
