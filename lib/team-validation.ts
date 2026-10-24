// Pure validation for teams (no runtime imports, so it runs in unit tests and in the browser).
import type { TeamInput } from "../app/teams/types";

export type TeamField = keyof TeamInput;
export type TeamErrors = Partial<Record<TeamField, string>>;

export const TEAM_LIMITS = { name: 60, description: 500 } as const;
export const TEAM_COLOR_RE = /^#[0-9a-f]{6}$/;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Trim/normalise whatever the client sent (be liberal in what we accept). */
export function cleanTeamInput(input: Partial<TeamInput> | null | undefined): TeamInput {
  const raw = input && typeof input === "object" ? input : {};
  const seen = new Set<string>();
  const memberIds = (Array.isArray(raw.memberIds) ? raw.memberIds : [])
    .map(str)
    .filter((id) => id && !seen.has(id) && seen.add(id));
  return {
    name: str(raw.name).replace(/\s+/g, " "),
    description: str(raw.description),
    color: str(raw.color).toLowerCase(),
    leadId: str(raw.leadId),
    memberIds,
  };
}

/**
 * Validates cleaned input. `current` = the team being edited: its existing members may stay
 * even if they were deactivated since; new members must be active users.
 */
export function validateTeam(
  input: TeamInput,
  users: { id: string; isActive: boolean }[],
  teams: { id: string; name: string }[],
  current?: { id: string; memberIds: string[] }
): TeamErrors {
  const e: TeamErrors = {};
  if (!input.name) e.name = "Name is required";
  else if (input.name.length > TEAM_LIMITS.name) e.name = `Keep it under ${TEAM_LIMITS.name} characters`;
  else if (teams.some((t) => t.id !== current?.id && t.name.trim().toLowerCase() === input.name.toLowerCase())) e.name = "A team with this name already exists";

  if (input.description.length > TEAM_LIMITS.description) e.description = `Keep it under ${TEAM_LIMITS.description} characters`;
  if (!TEAM_COLOR_RE.test(input.color)) e.color = "Pick a colour";

  const byId = new Map(users.map((u) => [u.id, u]));
  const kept = new Set(current?.memberIds ?? []);
  if (input.memberIds.length === 0) e.memberIds = "Add at least one member";
  else if (input.memberIds.some((id) => !byId.has(id))) e.memberIds = "Some selected people no longer exist";
  else if (input.memberIds.some((id) => !byId.get(id)!.isActive && !kept.has(id))) e.memberIds = "Inactive people can't be added";

  if (input.leadId && !input.memberIds.includes(input.leadId)) e.leadId = "The lead must be a member of the team";
  return e;
}
