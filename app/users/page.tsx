import { loadDirectory } from "../../lib/actions";
import { getLocations, getRoles } from "../../lib/settings";
import { calculateMeritScore, calculateAvgCorrectness } from "../lib/merit";
import UsersClient from "./UsersClient";
import type { UserOptions, UserRow } from "./types";

// Data comes from Google Sheets; always render per request.
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [{ users, tasks, error }, locations, roles] = await Promise.all([loadDirectory(), getLocations(), getRoles()]);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const options: UserOptions = {
    locations: locations.map((l) => ({ id: l.id, name: l.name, active: l.active })),
    roles: roles.map((r) => ({ id: r.id, name: r.name, active: r.active })),
  };

  const rows: UserRow[] = users.map((user) => {
    const userTasks = tasks.filter((t) => t.userId === user.id);
    return {
      ...user,
      locationName: user.locationId ? locationName.get(user.locationId) ?? null : null,
      roleName: user.roleId ? roleName.get(user.roleId) ?? null : null,
      meritScore: calculateMeritScore(userTasks),
      tasksCompleted: userTasks.length,
      avgCorrectness: calculateAvgCorrectness(userTasks),
    };
  });

  return <UsersClient users={rows} options={options} loadError={error} />;
}
