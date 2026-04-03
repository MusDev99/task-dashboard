import { getTasks, getUsers } from "../../lib/actions";
import { calculateMeritScore, calculateAvgCorrectness } from "../lib/merit";
import LeaderboardClient from "./LeaderboardClient";

export default async function LeaderboardPage() {
  const [users, tasks] = await Promise.all([getUsers(), getTasks()]);

  const leaderboard = users
    .map((user) => {
      const userTasks = tasks.filter((t) => t.userId === user.id);
      return {
        user,
        // @ts-ignore
        meritScore: calculateMeritScore(userTasks),
        tasksCompleted: userTasks.length,
        // @ts-ignore
        avgCorrectness: calculateAvgCorrectness(userTasks),
        rank: 0,
      };
    })
    .sort((a, b) => b.meritScore - a.meritScore)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return <LeaderboardClient initialLeaderboard={leaderboard} />;
}
