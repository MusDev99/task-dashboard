"use server";

import { revalidatePath } from "next/cache";
import { appendRow, updateRowById, deleteRowsWhere, readTable, upsertRowsById } from "./store";
import { getUsers } from "./actions";
import { TEAM_COLUMNS, USER_COLUMNS, WORK_TASK_COLUMNS } from "./schema";
import { cleanUserInput, validateUserInput, type FieldErrors, type UserInput, type UserRefs } from "./validation";
import { getLocations, getRoles } from "./settings";
import type { User } from "../app/lib/types";
import { requireSession } from "./auth";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; errors?: FieldErrors; message?: string };

// Same format as the existing data: "2026-01-21 06:55:00.915" (UTC).
const nowStamp = () => new Date().toISOString().replace("T", " ").replace("Z", "");

function refresh() {
  for (const p of ["/users", "/", "/roster", "/tasks", "/teams"]) revalidatePath(p);
}

async function userRefs(): Promise<UserRefs> {
  const [locations, roles] = await Promise.all([getLocations(), getRoles()]);
  return {
    activeLocationIds: new Set(locations.filter((l) => l.active).map((l) => l.id)),
    activeRoleIds: new Set(roles.filter((r) => r.active).map((r) => r.id)),
  };
}

const fail = (e: unknown): { ok: false; message: string } => {
  console.error(e);
  return { ok: false, message: "Couldn't save right now. Please try again." };
};

export async function createUser(raw: Partial<UserInput>): Promise<ActionResult<User>> {
  await requireSession();
  const input = cleanUserInput(raw);
  try {
    const users = await getUsers();
    const errors = validateUserInput(input, users, await userRefs());
    if (Object.keys(errors).length) return { ok: false, errors };

    const stamp = nowStamp();
    const user: User = {
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name,
      employeeId: input.employeeId || null,
      googleId: null,
      isActive: input.isActive,
      joinedDate: stamp,
      updatedAt: stamp,
      phoneNumber: input.phoneNumber || null,
      roleId: input.roleId || null,
      avatar: input.avatar || null,
      locationId: input.locationId || null,
    };
    await appendRow("users", USER_COLUMNS, user as unknown as Record<string, string | boolean | null>);
    refresh();
    return { ok: true, data: user };
  } catch (e) {
    return fail(e);
  }
}

export async function updateUser(id: string, raw: Partial<UserInput>): Promise<ActionResult<User>> {
  await requireSession();
  const input = cleanUserInput(raw);
  try {
    const users = await getUsers();
    const current = users.find((u) => u.id === id);
    if (!current) return { ok: false, message: "This user no longer exists." };

    const errors = validateUserInput(input, users, await userRefs(), id);
    if (Object.keys(errors).length) return { ok: false, errors };

    // id, joinedDate and googleId are never editable.
    const user: User = {
      ...current,
      email: input.email,
      name: input.name,
      employeeId: input.employeeId || null,
      isActive: input.isActive,
      phoneNumber: input.phoneNumber || null,
      roleId: input.roleId || null,
      avatar: input.avatar || null,
      locationId: input.locationId || null,
      updatedAt: nowStamp(),
    };
    const found = await updateRowById("users", USER_COLUMNS, id, user as unknown as Record<string, string | boolean | null>);
    if (!found) return { ok: false, message: "This user no longer exists." };
    refresh();
    return { ok: true, data: user };
  } catch (e) {
    return fail(e);
  }
}

/** Hard delete: cleans up everything that points at the user first, then removes the user. */
export async function deleteUser(id: string): Promise<ActionResult<null>> {
  await requireSession();
  try {
    // Dependents first, so a failure never leaves rows pointing at a deleted user.
    await deleteRowsWhere("roster", "userId", id).catch((e) => {
      // The roster tab only exists after its first write; a missing tab just means nothing to delete.
      if (!String(e).includes("not found") && !String(e).includes("Unable to parse range")) throw e;
    });
    // Work tasks are kept but unassigned (the work still needs doing).
    await unassignWorkTasks(id);
    // Team memberships go; teams they led keep going without a lead.
    await removeFromTeams(id);
    const usersDeleted = await deleteRowsWhere("users", "id", id);
    if (usersDeleted === 0) return { ok: false, message: "This user no longer exists." };
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

async function unassignWorkTasks(userId: string) {
  let rows;
  try {
    rows = await readTable("work_tasks");
  } catch (e) {
    if (String(e).includes("Unable to parse range")) return; // tab not created yet
    throw e;
  }
  const stamp = new Date().toISOString().replace("T", " ").replace("Z", "");
  const mine = rows.filter((r) => String(r.assigneeId ?? "") === userId).map((r) => ({ ...r, assigneeId: "", updatedAt: stamp }));
  await upsertRowsById("work_tasks", WORK_TASK_COLUMNS, mine);
}

async function removeFromTeams(userId: string) {
  try {
    await deleteRowsWhere("team_members", "userId", userId);
    const led = (await readTable("teams")).filter((r) => String(r.leadId ?? "") === userId);
    await upsertRowsById("teams", TEAM_COLUMNS, led.map((r) => ({ ...r, leadId: "", updatedAt: nowStamp() })));
  } catch (e) {
    if (String(e).includes("Unable to parse range") || String(e).includes("not found")) return; // tabs not created yet
    throw e;
  }
}
