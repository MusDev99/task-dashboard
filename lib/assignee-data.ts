import "server-only";
import { getRoster, getUsers, loadWorkTasks } from "./actions";
import { getShiftConfig } from "./shifts";
import { getTaskConfig } from "./task-config";
import { availability, monthsBetween, taskWindow, workload } from "./capacity";

/** Shared read for the assignee picker and Smart assign: active users' availability + workload over a task window. */
export async function loadAssigneeData(start: string | null, due: string | null, excludeTaskId?: string | null) {
  const [users, shifts, config, loaded] = await Promise.all([getUsers(), getShiftConfig(), getTaskConfig(), loadWorkTasks()]);
  const window = taskWindow(start, due);
  const roster = window ? (await Promise.all(monthsBetween(window[0], window[1]).map((m) => getRoster(m)))).flatMap((r) => r.entries) : [];
  const active = users.filter((u) => u.isActive).map((u) => u.id);
  const list = availability(active, window, roster, shifts, workload(loaded.tasks, config, excludeTaskId ?? undefined));
  return { users, tasks: loaded.tasks, tasksError: loaded.error, list };
}
