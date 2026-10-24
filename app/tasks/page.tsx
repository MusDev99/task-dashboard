import { loadTeams, loadUsers, loadWorkTasks } from "../../lib/actions";
import { toTeamOptions } from "../../lib/teams";
import { getTaskConfig } from "../../lib/task-config";
import { getShiftConfig } from "../../lib/shifts";
import { todayIn } from "../../lib/roster-dates";
import TasksClient from "./TasksClient";
import type { Person } from "./types";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [config, shifts] = await Promise.all([getTaskConfig(), getShiftConfig()]);
  const [{ users, error: usersError }, { tasks, error: tasksError }, teamData] = await Promise.all([loadUsers(), loadWorkTasks(), loadTeams()]);
  const people: Person[] = users
    .map((u) => ({ id: u.id, name: u.name, email: u.email, employeeId: u.employeeId, avatar: u.avatar, isActive: u.isActive }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <TasksClient tasks={tasks} people={people} teams={toTeamOptions(teamData.teams, teamData.members)} config={config} today={todayIn(shifts.timezone)} loadError={usersError || tasksError || teamData.error} />;
}
