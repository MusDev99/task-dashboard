"use server";

import { revalidatePath } from "next/cache";
import { appendRow, deleteRowsByIds, ensureTab, readTable, updateRowById, upsertRowsById } from "./store";
import { loadLeaveRequests, loadTeams, readUsers } from "./actions";
import { getShiftConfig } from "./shifts";
import { LEAVE_COLUMNS, ROSTER_COLUMNS } from "./schema";
import { MAX_LEAVE_DAYS, NOTE_MAX, canDecideLeave, canRevokeLeave, canTransition, cleanLeaveInput, datesBetween, planRevoke, validateLeaveInput, type LeaveErrors, type LeaveInput, type LeaveRequest } from "./leave";
import { ledUserIds } from "./access";
import { actorWith, forbidden } from "./auth";
import { recordAudit } from "./audit-log";
import { notifyUsers } from "./notify";
import { leaveApprovers } from "./notifications";
import { rosterId, todayIn } from "./roster-dates";

export type LeaveResult<T = null> = { ok: true; data: T } | { ok: false; errors?: LeaveErrors; message?: string };

const nowStamp = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const refresh = () => {
  for (const p of ["/leave", "/roster", "/"]) revalidatePath(p);
};
const fail = (e: unknown): { ok: false; message: string } => {
  console.error(e);
  return { ok: false, message: "Couldn't save right now. Please try again." };
};
const toRow = (r: LeaveRequest) => ({ ...r });

/** Ask for leave for yourself. Nobody can file a request for someone else. */
export async function requestLeave(raw: Partial<LeaveInput>): Promise<LeaveResult<LeaveRequest>> {
  const { actor, denied } = await actorWith("leave.request", "requestLeave");
  if (denied) return denied;
  if (!actor.uid) return { ok: false, message: "Sign in as a registered person to request leave." };
  try {
    const input = cleanLeaveInput(raw ?? {});
    const [config, loaded] = await Promise.all([getShiftConfig(), loadLeaveRequests()]);
    if (loaded.error) throw new Error("leave requests could not be loaded");
    const errors = validateLeaveInput(input, {
      today: todayIn(config.timezone),
      leaveCodes: config.codes.filter((c) => c.type === "leave"),
      existing: loaded.requests.filter((r) => r.userId === actor.uid),
    });
    if (Object.keys(errors).length) return { ok: false, errors };

    const stamp = nowStamp();
    const request: LeaveRequest = { id: crypto.randomUUID(), userId: actor.uid, ...input, status: "pending", decidedBy: "", decidedAt: "", decisionNote: "", createdAt: stamp, updatedAt: stamp };
    await ensureTab("leave_requests", LEAVE_COLUMNS);
    await appendRow("leave_requests", LEAVE_COLUMNS, toRow(request));
    const n = datesBetween(input.startDate, input.endDate).length;
    await recordAudit(actor, { action: "create", entity: "leave", entityId: request.id, summary: `Requested ${input.code} ${input.startDate} to ${input.endDate} (${n} day${n === 1 ? "" : "s"})` });
    // Tell the people who can decide. Best effort: never fails the request itself.
    try {
      const [users, teams] = await Promise.all([readUsers(), loadTeams()]);
      const me = users.find((u) => u.id === actor.uid);
      await notifyUsers(
        leaveApprovers(actor.uid, users, teams.error ? [] : teams.teams, teams.error ? [] : teams.members),
        { kind: "leave_requested", title: `${(me?.name ?? "Someone").replace(/\s-\s*$/, "")} requested leave`, body: `${input.code} · ${input.startDate} to ${input.endDate} (${n} day${n === 1 ? "" : "s"})`, href: "/leave" },
        actor.uid,
      );
    } catch (e) {
      console.error("leave notification failed", e);
    }
    refresh();
    return { ok: true, data: request };
  } catch (e) {
    return fail(e);
  }
}

/** The requester withdraws a request that hasn't been decided yet. */
export async function cancelLeave(id: string): Promise<LeaveResult> {
  const { actor, denied } = await actorWith("leave.request", "cancelLeave");
  if (denied) return denied;
  try {
    const loaded = await loadLeaveRequests();
    if (loaded.error) throw new Error("leave requests could not be loaded");
    const r = loaded.requests.find((x) => x.id === id);
    if (!r) return { ok: false, message: "This request no longer exists." };
    if (!actor.uid || r.userId !== actor.uid) return forbidden("cancelLeave", actor);
    if (!canTransition(r.status, "cancelled")) return { ok: false, message: "Only a pending request can be cancelled." };
    await updateRowById("leave_requests", LEAVE_COLUMNS, id, toRow({ ...r, status: "cancelled", updatedAt: nowStamp() }));
    await recordAudit(actor, { action: "status", entity: "leave", entityId: id, summary: `Cancelled their ${r.code} request for ${r.startDate} to ${r.endDate}` });
    refresh();
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Approve or reject a pending request. Approving writes the leave code into the roster for every day of the
 * request (replacing any shift already there) BEFORE the request is marked approved, so a failure in between
 * leaves a retryable pending request, never an "approved" one with no roster days.
 */
export async function decideLeave(id: string, decision: "approved" | "rejected", rawNote?: string): Promise<LeaveResult<{ days: number; replaced: number }>> {
  const { actor, denied } = await actorWith("leave.decide", "decideLeave");
  if (denied) return denied;
  if (decision !== "approved" && decision !== "rejected") return { ok: false, message: "Choose approve or reject." };
  const note = String(rawNote ?? "").replace(/\s+/g, " ").trim();
  if (note.length > NOTE_MAX) return { ok: false, message: `Note must be ${NOTE_MAX} characters or fewer.` };
  try {
    const loaded = await loadLeaveRequests();
    if (loaded.error) throw new Error("leave requests could not be loaded");
    const r = loaded.requests.find((x) => x.id === id);
    if (!r) return { ok: false, message: "This request no longer exists." };

    let scope: Set<string> | null = null;
    if (actor.level === "lead") {
      const teams = await loadTeams();
      if (teams.error) throw new Error("teams could not be loaded"); // fail closed
      scope = ledUserIds(actor.uid, teams.teams, teams.members);
    }
    if (!canDecideLeave(actor.level, actor.uid, r.userId, scope)) return forbidden("decideLeave", actor);
    if (!canTransition(r.status, decision)) return { ok: false, message: "This request has already been dealt with." };

    let days = 0;
    let replaced = 0;
    if (decision === "approved") {
      const dates = datesBetween(r.startDate, r.endDate);
      if (dates.length === 0 || dates.length > MAX_LEAVE_DAYS) return { ok: false, message: "This request has invalid dates. Reject it and ask for a new one." };
      const config = await getShiftConfig();
      if (!config.codes.some((c) => c.code === r.code && c.type === "leave")) return { ok: false, message: "This leave type no longer exists. Reject the request and ask for a new one." };
      await ensureTab("roster", ROSTER_COLUMNS);
      const existing = new Map((await readTable("roster")).filter((x) => String(x.userId) === r.userId).map((x) => [String(x.date), String(x.code)]));
      replaced = dates.filter((d) => existing.has(d) && existing.get(d) !== r.code).length;
      const stamp = nowStamp();
      await upsertRowsById("roster", ROSTER_COLUMNS, dates.map((date) => ({ id: rosterId(r.userId, date), userId: r.userId, date, type: "leave", code: r.code, updatedAt: stamp })));
      days = dates.length;
    }
    const stamp = nowStamp();
    await updateRowById("leave_requests", LEAVE_COLUMNS, id, toRow({ ...r, status: decision, decidedBy: actor.uid, decidedAt: stamp, decisionNote: note, updatedAt: stamp }));
    await recordAudit(actor, {
      action: "status", entity: "leave", entityId: id,
      summary: `${decision === "approved" ? "Approved" : "Rejected"} ${r.code} ${r.startDate} to ${r.endDate}${decision === "approved" ? ` (${days} roster day${days === 1 ? "" : "s"}${replaced ? `, ${replaced} replaced a shift` : ""})` : ""}`,
    });
    await notifyUsers(
      [r.userId],
      { kind: "leave_decided", title: `Your leave was ${decision}`, body: `${r.code} · ${r.startDate} to ${r.endDate}${note ? ` · ${note}` : ""}`, href: "/leave" },
      actor.uid,
    );
    refresh();
    return { ok: true, data: { days, replaced } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Take back approved leave: the requester for their own, or anyone who could decide it. Only roster days from
 * today on that still hold the leave code are cleared (a day a planner changed since is left alone), and days
 * already gone stay as history. Leave that hasn't started becomes "revoked"; leave under way is shortened to end
 * yesterday. The roster is cleared BEFORE the request changes, so a failure in between is retryable.
 */
export async function revokeLeave(id: string, rawNote?: string): Promise<LeaveResult<{ kind: "revoked" | "shortened"; cleared: number; untouched: number }>> {
  const { actor, denied } = await actorWith("leave.request", "revokeLeave");
  if (denied) return denied;
  const note = String(rawNote ?? "").replace(/\s+/g, " ").trim();
  if (note.length > NOTE_MAX) return { ok: false, message: `Note must be ${NOTE_MAX} characters or fewer.` };
  try {
    const loaded = await loadLeaveRequests();
    if (loaded.error) throw new Error("leave requests could not be loaded");
    const r = loaded.requests.find((x) => x.id === id);
    if (!r) return { ok: false, message: "This request no longer exists." };

    let scope: Set<string> | null = null;
    if (actor.level === "lead") {
      const teams = await loadTeams();
      if (teams.error) throw new Error("teams could not be loaded"); // fail closed
      scope = ledUserIds(actor.uid, teams.teams, teams.members);
    }
    if (!canRevokeLeave(actor.level, actor.uid, r.userId, scope)) return forbidden("revokeLeave", actor);
    if (!canTransition(r.status, "revoked")) return { ok: false, message: "Only approved leave can be revoked." };

    const config = await getShiftConfig();
    await ensureTab("roster", ROSTER_COLUMNS);
    const mine = (await readTable("roster")).filter((x) => String(x.userId) === r.userId).map((x) => ({ date: String(x.date), code: String(x.code) }));
    const plan = planRevoke(r, todayIn(config.timezone), mine);
    if (plan.kind === "nothing") return { ok: false, message: "This leave has already ended, so there is nothing to revoke." };

    await deleteRowsByIds("roster", plan.clear.map((d) => rosterId(r.userId, d)));
    const stamp = nowStamp();
    const next: LeaveRequest = plan.kind === "revoked"
      ? { ...r, status: "revoked", decidedBy: actor.uid, decidedAt: stamp, decisionNote: note, updatedAt: stamp }
      : { ...r, endDate: plan.newEndDate ?? r.endDate, decisionNote: `Shortened from ${r.endDate}${note ? ` · ${note}` : ""}`, updatedAt: stamp };
    await updateRowById("leave_requests", LEAVE_COLUMNS, id, toRow(next));

    const verb = plan.kind === "revoked" ? "Revoked" : "Shortened";
    const own = actor.uid === r.userId;
    await recordAudit(actor, {
      action: "status", entity: "leave", entityId: id,
      summary: `${own ? "Cancelled their approved" : `${verb}`} ${r.code} leave ${r.startDate} to ${r.endDate}${plan.kind === "shortened" ? ` (now ends ${next.endDate})` : ""}: ${plan.clear.length} roster day${plan.clear.length === 1 ? "" : "s"} cleared${plan.untouched ? `, ${plan.untouched} left as they were` : ""}`,
    });
    // Tell the other side: the requester if someone else revoked it, the approvers if the requester took it back.
    try {
      if (own) {
        const [users, teams] = await Promise.all([readUsers(), loadTeams()]);
        const me = users.find((u) => u.id === actor.uid);
        await notifyUsers(
          leaveApprovers(actor.uid, users, teams.error ? [] : teams.teams, teams.error ? [] : teams.members),
          { kind: "leave_revoked", title: `${(me?.name ?? "Someone").replace(/\s-\s*$/, "")} cancelled approved leave`, body: `${r.code} · ${r.startDate} to ${r.endDate}${note ? ` · ${note}` : ""}`, href: "/roster" },
          actor.uid,
        );
      } else {
        await notifyUsers(
          [r.userId],
          { kind: "leave_revoked", title: `Your approved leave was ${plan.kind === "revoked" ? "revoked" : "shortened"}`, body: `${r.code} · ${r.startDate} to ${r.endDate}${plan.kind === "shortened" ? ` (now ends ${next.endDate})` : ""}${note ? ` · ${note}` : ""}`, href: "/leave" },
          actor.uid,
        );
      }
    } catch (e) {
      console.error("revoke notification failed", e);
    }
    refresh();
    return { ok: true, data: { kind: plan.kind, cleared: plan.clear.length, untouched: plan.untouched } };
  } catch (e) {
    return fail(e);
  }
}
