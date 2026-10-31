// Role-based access (pure, no data access). Fixed access levels; leads are scoped by the teams they lead.
// No runtime imports on purpose: tests run this file directly with `node --test`.

export const ACCESS_LEVELS = ["admin", "planner", "lead", "member"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_LABELS: Record<AccessLevel, { label: string; hint: string }> = {
  admin: { label: "Admin", hint: "Everything, including users, access levels and settings" },
  planner: { label: "Planner", hint: "Full roster and tasks, teams; settings read-only" },
  lead: { label: "Lead", hint: "Roster of the teams they lead, tasks, their own teams" },
  member: { label: "Member", hint: "View only; can update the status of their own tasks" },
};

export type Capability =
  | "roster.edit" // set / clear cells (leads: only people in teams they lead)
  | "roster.bulk" // clear schedule, CSV import
  | "tasks.edit" // create / edit / delete tasks and subtasks
  | "tasks.statusOwn" // change the status of a task assigned to me
  | "teams.manage" // create / edit / delete any team
  | "teams.editLed" // edit teams I lead (not create / delete)
  | "users.view"
  | "users.edit" // includes access levels
  | "settings.view"
  | "settings.edit";

const MATRIX: Record<AccessLevel, readonly Capability[]> = {
  admin: ["roster.edit", "roster.bulk", "tasks.edit", "tasks.statusOwn", "teams.manage", "teams.editLed", "users.view", "users.edit", "settings.view", "settings.edit"],
  planner: ["roster.edit", "roster.bulk", "tasks.edit", "tasks.statusOwn", "teams.manage", "teams.editLed", "users.view", "settings.view"],
  lead: ["roster.edit", "tasks.edit", "tasks.statusOwn", "teams.editLed", "users.view"],
  member: ["tasks.statusOwn"],
};

export const FORBIDDEN_MESSAGE = "You don't have permission to do that.";

export const isAccessLevel = (v: unknown): v is AccessLevel => typeof v === "string" && (ACCESS_LEVELS as readonly string[]).includes(v);

/** Stored value → level. Unknown or empty means the least privilege. */
export function parseAccess(v: unknown): AccessLevel {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return isAccessLevel(s) ? s : "member";
}

export function can(level: AccessLevel, capability: Capability): boolean {
  return MATRIX[level].includes(capability);
}

/** Whether roster edits for this level are limited to the people in teams the actor leads. */
export const rosterScoped = (level: AccessLevel) => level === "lead";

/** Everyone in the teams `uid` leads (the lead included, since a lead is always a member). */
export function ledUserIds(
  uid: string,
  teams: readonly { id: string; leadId: string | null }[],
  members: readonly { teamId: string; userId: string }[],
): Set<string> {
  const led = new Set(teams.filter((t) => t.leadId === uid).map((t) => t.id));
  return new Set(members.filter((m) => led.has(m.teamId)).map((m) => m.userId));
}

/** The user ids an actor may not edit on the roster (empty = all allowed). */
export function rosterRefused(level: AccessLevel, targetUserIds: readonly string[], scope: Set<string> | null): string[] {
  if (!can(level, "roster.edit")) return [...new Set(targetUserIds)];
  if (!rosterScoped(level)) return [];
  return [...new Set(targetUserIds)].filter((id) => !scope?.has(id));
}

export function canSetTaskStatus(level: AccessLevel, uid: string, assigneeId: string | null): boolean {
  if (can(level, "tasks.edit")) return true;
  return can(level, "tasks.statusOwn") && !!uid && assigneeId === uid;
}

export function canEditTeam(level: AccessLevel, uid: string, team: { leadId: string | null }): boolean {
  return can(level, "teams.manage") || (can(level, "teams.editLed") && !!uid && team.leadId === uid);
}

/**
 * True when applying `next` to user `targetId` (null = delete) would leave no active admin.
 * Guards against locking everyone out of user admin and settings.
 */
export function removesLastAdmin(
  users: readonly { id: string; access: AccessLevel; isActive: boolean }[],
  targetId: string,
  next: { access: AccessLevel; isActive: boolean } | null,
): boolean {
  const after = users.flatMap((u) => (u.id !== targetId ? [u] : next ? [{ ...u, ...next }] : []));
  const before = users.some((u) => u.access === "admin" && u.isActive);
  return before && !after.some((u) => u.access === "admin" && u.isActive);
}
