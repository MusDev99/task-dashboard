// Pure team helpers (no data access) shared by /teams, /roster and /tasks.
import type { Team, TeamMember, TeamOption, TeamRow } from "../app/teams/types";

export const memberId = (teamId: string, userId: string) => `${teamId}_${userId}`;

/** teamId → member user ids (in stored order). */
export function membersByTeam(members: TeamMember[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const x of members) m.set(x.teamId, [...(m.get(x.teamId) ?? []), x.userId]);
  return m;
}

/** userId → team ids. */
export function teamsByUser(members: TeamMember[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const x of members) m.set(x.userId, [...(m.get(x.userId) ?? []), x.teamId]);
  return m;
}

/** Teams with their members, members restricted to users that still exist. */
export function toTeamRows(teams: Team[], members: TeamMember[], userIds: Set<string>): TeamRow[] {
  const byTeam = membersByTeam(members);
  return teams.map((t) => ({ ...t, memberIds: (byTeam.get(t.id) ?? []).filter((id) => userIds.has(id)) }));
}

/** Teams for filter dropdowns, sorted by name. */
export function toTeamOptions(teams: Team[], members: TeamMember[]): TeamOption[] {
  const byTeam = membersByTeam(members);
  return teams
    .map((t) => ({ id: t.id, name: t.name, color: t.color, memberIds: byTeam.get(t.id) ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
