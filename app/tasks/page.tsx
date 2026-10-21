import { loadUsers, loadWorkTasks } from "../../lib/actions";
import { getTaskConfig } from "../../lib/task-config";
import { getShiftConfig } from "../../lib/shifts";
import { todayIn } from "../../lib/roster-dates";
import TasksClient from "./TasksClient";
import type { Person } from "./types";

// Data comes from Google Sheets; always render per request.
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [config, shifts] = await Promise.all([getTaskConfig(), getShiftConfig()]);
  const [{ users, error: usersError }, { tasks, error: tasksError }] = await Promise.all([loadUsers(), loadWorkTasks()]);
  const people: Person[] = users
    .map((u) => ({ id: u.id, name: u.name, email: u.email, employeeId: u.employeeId, avatar: u.avatar, isActive: u.isActive }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return <TasksClient tasks={tasks} people={people} config={config} today={todayIn(shifts.timezone)} loadError={usersError || tasksError} />;
}
