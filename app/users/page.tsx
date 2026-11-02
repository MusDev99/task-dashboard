import { loadUsers } from "../../lib/actions";
import { getLocations, getRoles } from "../../lib/settings";
import UsersClient from "./UsersClient";
import NoAccess from "../components/NoAccess";
import { viewer, viewerCan } from "../../lib/auth";
import type { UserOptions, UserRow } from "./types";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await viewer();
  if (!viewerCan(me, "users.view")) return <NoAccess what="Users" />;
  const [{ users, error }, locations, roles] = await Promise.all([loadUsers(), getLocations(), getRoles()]);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const options: UserOptions = {
    locations: locations.map((l) => ({ id: l.id, name: l.name, active: l.active })),
    roles: roles.map((r) => ({ id: r.id, name: r.name, active: r.active })),
  };

  const rows: UserRow[] = users.map((user) => ({
    ...user,
    locationName: user.locationId ? locationName.get(user.locationId) ?? null : null,
    roleName: user.roleId ? roleName.get(user.roleId) ?? null : null,
  }));

  return <UsersClient users={rows} options={options} loadError={error} canEdit={viewerCan(me, "users.edit")} />;
}
