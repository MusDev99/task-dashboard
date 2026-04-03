import { getTasks, getUsers } from "../../lib/actions";
import TaskListClient from "./TaskListClient";

export default async function TaskListPage() {
  const [tasks, users] = await Promise.all([getTasks(), getUsers()]);

  return <TaskListClient initialTasks={tasks} users={users} />;
}
