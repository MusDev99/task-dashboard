import { loadLeaveRequests, loadTeams, loadUsers } from "../../lib/actions";
import { getShiftConfig } from "../../lib/shifts";
import { viewer } from "../../lib/auth";
import { ledUserIds } from "../../lib/access";
import { canDecideLeave, canRevokeLeave, visibleLeave } from "../../lib/leave";
import { todayIn } from "../../lib/roster-dates";
import NoAccess from "../components/NoAccess";
import LeaveClient from "./LeaveClient";
import type { LeaveRow } from "./types";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";
export const metadata = { title: "Leave · WorkForce Management" };

export default async function LeavePage() {
  const me = await viewer();
  if (!me) return <NoAccess what="leave requests" />;
  const [leave, { users, error: usersError }, config, teams] = await Promise.all([loadLeaveRequests(), loadUsers(), getShiftConfig(), loadTeams()]);

  const scope = me.level === "lead" ? ledUserIds(me.uid, teams.teams, teams.members) : null;
  // A lead whose teams can't be read sees only their own requests and can't decide (fail closed).
  const safeScope = me.level === "lead" && teams.error ? new Set<string>() : scope;
  const names = new Map(users.map((u) => [u.id, u.name]));
  const today = todayIn(config.timezone);
  const rows: LeaveRow[] = visibleLeave(leave.requests, me.level, me.uid, safeScope).map((r) => ({
    ...r,
    userName: names.get(r.userId) ?? "Removed user",
    decidedByName: r.decidedBy ? names.get(r.decidedBy) ?? "Removed user" : "",
    mine: !!me.uid && r.userId === me.uid,
    decidable: r.status === "pending" && canDecideLeave(me.level, me.uid, r.userId, safeScope),
    // Approved and not over yet: the requester can take it back, and so can anyone who could decide it.
    revocable: r.status === "approved" && r.endDate >= today && canRevokeLeave(me.level, me.uid, r.userId, safeScope),
  }));

  return (
    <LeaveClient
      rows={rows}
      leaveTypes={config.codes.filter((c) => c.type === "leave").map((c) => ({ code: c.code, label: c.label, color: c.color, active: c.active }))}
      myRequests={leave.requests.filter((r) => me.uid && r.userId === me.uid).map((r) => ({ id: r.id, startDate: r.startDate, endDate: r.endDate, status: r.status }))}
      today={today}
      canRequest={!!me.uid}
      loadError={leave.error || usersError || (me.level === "lead" && teams.error)}
    />
  );
}
