import { loadTeams, loadUsers } from "../../lib/actions";
import { toTeamRows } from "../../lib/teams";
import { getLocations } from "../../lib/settings";
import TeamsClient from "./TeamsClient";
import type { TeamPerson } from "./types";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";
export const metadata = { title: "Teams · WorkForce Management" };

export default async function TeamsPage() {
  const [{ users, error: usersError }, { teams, members, error: teamsError }, locations] = await Promise.all([loadUsers(), loadTeams(), getLocations()]);
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const people: TeamPerson[] = users
    .map((u) => ({ id: u.id, name: u.name, email: u.email, employeeId: u.employeeId, avatar: u.avatar, isActive: u.isActive, locationName: u.locationId ? locationName.get(u.locationId) ?? null : null }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const rows = toTeamRows(teams, members, new Set(users.map((u) => u.id)));

  return <TeamsClient teams={rows} people={people} loadError={usersError || teamsError} />;
}
