"use server";

import { revalidatePath } from "next/cache";
import { appendRow, deleteRowsByIds, deleteRowsWhere, ensureTab, updateRowById, upsertRowsById, type Cell } from "./store";
import { getUsers, loadTeams } from "./actions";
import { TEAM_COLUMNS, TEAM_MEMBER_COLUMNS } from "./schema";
import { cleanTeamInput, validateTeam, type TeamErrors } from "./team-validation";
import { memberId, toTeamRows } from "./teams";
import type { Team, TeamInput } from "../app/teams/types";
import { requireSession } from "./auth";

export type TeamResult<T> = { ok: true; data: T } | { ok: false; errors?: TeamErrors; message?: string };

const nowStamp = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const refresh = () => {
  for (const p of ["/teams", "/roster", "/tasks", "/users"]) revalidatePath(p);
};
const fail = (e: unknown): { ok: false; message: string } => {
  console.error(e);
  return { ok: false, message: "Couldn't save right now. Please try again." };
};

async function context() {
  await Promise.all([ensureTab("teams", TEAM_COLUMNS), ensureTab("team_members", TEAM_MEMBER_COLUMNS)]);
  const [users, loaded] = await Promise.all([getUsers(), loadTeams()]);
  if (loaded.error) throw new Error("teams could not be loaded");
  const rows = toTeamRows(loaded.teams, loaded.members, new Set(users.map((u) => u.id)));
  return { users, rows, members: loaded.members };
}

const memberRows = (teamId: string, userIds: string[], stamp: string): Record<string, Cell>[] =>
  userIds.map((userId) => ({ id: memberId(teamId, userId), teamId, userId, addedAt: stamp }));

export async function createTeam(raw: Partial<TeamInput>): Promise<TeamResult<Team>> {
  await requireSession();
  const input = cleanTeamInput(raw);
  try {
    const { users, rows } = await context();
    const errors = validateTeam(input, users, rows);
    if (Object.keys(errors).length) return { ok: false, errors };

    const stamp = nowStamp();
    const team: Team = { id: crypto.randomUUID(), name: input.name, description: input.description, leadId: input.leadId || null, color: input.color, createdAt: stamp, updatedAt: stamp };
    // Team first, then memberships (a failure in between leaves an empty team, never orphan members).
    await appendRow("teams", TEAM_COLUMNS, { ...team });
    await upsertRowsById("team_members", TEAM_MEMBER_COLUMNS, memberRows(team.id, input.memberIds, stamp));
    refresh();
    return { ok: true, data: team };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTeam(id: string, raw: Partial<TeamInput>): Promise<TeamResult<Team>> {
  await requireSession();
  const input = cleanTeamInput(raw);
  try {
    if (typeof id !== "string" || !id) return { ok: false, message: "This team no longer exists." };
    const { users, rows, members } = await context();
    const current = rows.find((t) => t.id === id);
    if (!current) return { ok: false, message: "This team no longer exists." };
    const errors = validateTeam(input, users, rows, current);
    if (Object.keys(errors).length) return { ok: false, errors };

    const stamp = nowStamp();
    const stored = new Set(members.filter((m) => m.teamId === id).map((m) => m.userId));
    const added = input.memberIds.filter((u) => !stored.has(u));
    const removed = [...stored].filter((u) => !input.memberIds.includes(u));

    const team: Team = { id, name: input.name, description: input.description, leadId: input.leadId || null, color: input.color, createdAt: current.createdAt, updatedAt: stamp };
    // Add members before the team row points its lead at one of them; remove last.
    await upsertRowsById("team_members", TEAM_MEMBER_COLUMNS, memberRows(id, added, stamp));
    const found = await updateRowById("teams", TEAM_COLUMNS, id, { ...team });
    if (!found) return { ok: false, message: "This team no longer exists." };
    await deleteRowsByIds("team_members", removed.map((u) => memberId(id, u)));
    refresh();
    return { ok: true, data: team };
  } catch (e) {
    return fail(e);
  }
}

/** Removes the team's memberships first, then the team. Users are never deleted. */
export async function deleteTeam(id: string): Promise<TeamResult<{ membersRemoved: number }>> {
  await requireSession();
  if (typeof id !== "string" || !id) return { ok: false, message: "This team no longer exists." };
  try {
    await Promise.all([ensureTab("teams", TEAM_COLUMNS), ensureTab("team_members", TEAM_MEMBER_COLUMNS)]);
    const membersRemoved = await deleteRowsWhere("team_members", "teamId", id);
    const deleted = await deleteRowsWhere("teams", "id", id);
    if (deleted === 0) return { ok: false, message: "This team no longer exists." };
    refresh();
    return { ok: true, data: { membersRemoved } };
  } catch (e) {
    return fail(e);
  }
}
