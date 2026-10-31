import { readTable, type Cell } from "./store";
import { USER_REQUIRED_COLUMNS, WORK_TASK_COLUMNS, TEAM_COLUMNS, TEAM_MEMBER_COLUMNS } from "./schema";
import type { User } from "../app/lib/types";
import type { RosterEntry } from "../app/roster/types";
import type { WorkTask, TaskLink } from "../app/tasks/types";
import type { Team, TeamMember } from "../app/teams/types";
import { MONTH_RE } from "./roster-dates";
import { parseAccess } from "./access";

// Tables: see lib/schema.ts.

const str = (v: Cell): string | null => (v == null || v === "" ? null : String(v));
const bool = (v: Cell): boolean => v === true || String(v).toUpperCase() === "TRUE";

function toUser(r: Record<string, Cell>): User {
  return {
    id: String(r.id),
    email: String(r.email ?? ""),
    name: String(r.name ?? ""),
    employeeId: str(r.employeeId),
    googleId: str(r.googleId),
    isActive: bool(r.isActive),
    joinedDate: String(r.joinedDate ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
    phoneNumber: str(r.phoneNumber),
    roleId: str(r.roleId),
    avatar: str(r.avatar),
    locationId: str(r.locationId),
    // No access column yet (pre-migration) = everyone keeps the full access they had before levels existed.
    access: "access" in r ? parseAccess(r.access) : "admin",
  };
}

/** Fails loudly if a tab's header row was edited, instead of silently producing rows with undefined ids. */
function assertColumns(tab: string, rows: Record<string, Cell>[], columns: readonly string[]) {
  if (rows.length === 0) return;
  const missing = columns.filter((c) => !(c in rows[0]));
  if (missing.length) {
    const hint = tab === "users" && missing.includes("locationId") && "stationCode" in rows[0] ? " Run `npm run migrate:settings`." : "";
    throw new Error(`Tab "${tab}": header row is missing column(s) ${missing.map((m) => `"${m}"`).join(", ")}. Expected: ${columns.join(", ")}.${hint}`);
  }
}

export async function readUsers(): Promise<User[]> {
  const rows = await readTable("users");
  assertColumns("users", rows, USER_REQUIRED_COLUMNS);
  return rows.map(toUser);
}

export async function getUsers(): Promise<User[]> {
  try {
    return await readUsers();
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export async function getUserById(id: string): Promise<User | null> {
  return (await getUsers()).find((u) => u.id === id) ?? null;
}

function toRosterEntry(r: Record<string, Cell>): RosterEntry {
  return {
    id: String(r.id),
    userId: String(r.userId),
    date: String(r.date),
    type: r.type === "leave" ? "leave" : "shift",
    code: String(r.code ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

/** Roster entries for one month ("YYYY-MM"). The tab is created lazily on first write, so a missing tab reads as empty. */
export async function getRoster(month: string): Promise<{ entries: RosterEntry[]; error: boolean }> {
  if (!MONTH_RE.test(month)) return { entries: [], error: false };
  try {
    const rows = await readTable("roster");
    return { entries: rows.map(toRosterEntry).filter((e) => e.date.startsWith(month)), error: false };
  } catch (error) {
    // A table that hasn't been created yet answers 400 "Unable to parse range": treat that as empty.
    if (String(error).includes("Unable to parse range")) return { entries: [], error: false };
    console.error("Error fetching roster:", error);
    return { entries: [], error: true };
  }
}

/** Users with a load-failure flag, so the UI can say so instead of showing an empty list. */
export async function loadUsers(): Promise<{ users: User[]; error: boolean }> {
  try {
    return { users: await readUsers(), error: false };
  } catch (error) {
    console.error("Error loading users:", error);
    return { users: [], error: true };
  }
}

// ─── Work tasks ─────────────────────────────────────────────────────────────

function parseJson<T>(v: Cell, fallback: T): T {
  if (v == null || v === "") return fallback;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
}

function toWorkTask(r: Record<string, Cell>): WorkTask {
  const pts = r.storyPoints == null || r.storyPoints === "" ? null : Number(r.storyPoints);
  return {
    id: String(r.id),
    code: String(r.code ?? ""),
    parentId: str(r.parentId),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    status: String(r.status ?? "todo"),
    storyPoints: pts != null && Number.isFinite(pts) ? pts : null,
    assigneeId: str(r.assigneeId),
    labels: parseJson<string[]>(r.labels, []).filter((l) => typeof l === "string"),
    links: parseJson<TaskLink[]>(r.links, []).filter((l) => l && typeof l.url === "string"),
    startDate: str(r.startDate),
    dueDate: str(r.dueDate),
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

/** All work tasks + subtasks. The tab is created on first write, so a missing tab reads as empty. */
export async function loadWorkTasks(): Promise<{ tasks: WorkTask[]; error: boolean }> {
  try {
    const rows = await readTable("work_tasks");
    assertColumns("work_tasks", rows, WORK_TASK_COLUMNS);
    return { tasks: rows.map(toWorkTask), error: false };
  } catch (error) {
    if (String(error).includes("Unable to parse range")) return { tasks: [], error: false };
    console.error("Error loading work tasks:", error);
    return { tasks: [], error: true };
  }
}

// ─── Teams ──────────────────────────────────────────────────────────────────

/** Reads a tab that is created on first write: a missing tab reads as empty. */
async function readOptionalTable(tab: string, columns: readonly string[]): Promise<Record<string, Cell>[]> {
  try {
    const rows = await readTable(tab);
    assertColumns(tab, rows, columns);
    return rows;
  } catch (error) {
    if (String(error).includes("Unable to parse range")) return [];
    throw error;
  }
}

function toTeam(r: Record<string, Cell>): Team {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    description: String(r.description ?? ""),
    leadId: str(r.leadId),
    // Hand-edited cells may hold anything: only a #rrggbb value reaches the UI.
    color: /^#[0-9a-f]{6}$/.test(String(r.color ?? "").toLowerCase()) ? String(r.color).toLowerCase() : "#8b8da3",
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

function toTeamMember(r: Record<string, Cell>): TeamMember {
  return { id: String(r.id), teamId: String(r.teamId ?? ""), userId: String(r.userId ?? ""), addedAt: String(r.addedAt ?? "") };
}

/** All teams + memberships, with a load-failure flag. */
export async function loadTeams(): Promise<{ teams: Team[]; members: TeamMember[]; error: boolean }> {
  try {
    const [teams, members] = await Promise.all([readOptionalTable("teams", TEAM_COLUMNS), readOptionalTable("team_members", TEAM_MEMBER_COLUMNS)]);
    return { teams: teams.map(toTeam), members: members.map(toTeamMember).filter((m) => m.teamId && m.userId), error: false };
  } catch (error) {
    console.error("Error loading teams:", error);
    return { teams: [], members: [], error: true };
  }
}
