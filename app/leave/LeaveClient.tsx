"use client";

import { useMemo, useState, useTransition } from "react";
import { cancelLeave, decideLeave } from "../../lib/leave-actions";
import { LEAVE_STATUSES, LEAVE_STATUS_LABEL, dayCount, type LeaveStatus } from "../../lib/leave";
import Pagination from "../components/ui/Pagination";
import StatCard from "../components/ui/StatCard";
import ToastRegion from "../components/ui/Toast";
import { useToasts } from "../components/ui/useToasts";
import { AlertIcon, CalendarIcon, CheckIcon, ClockIcon, PlusIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import { RejectDialog, RequestDialog, RevokeDialog } from "./LeaveDialogs";
import type { LeaveRow, LeaveTypeOption } from "./types";

const BADGE: Record<LeaveStatus, string> = { pending: "badge-amber", approved: "badge-emerald", rejected: "badge-danger", cancelled: "badge-neutral", revoked: "badge-neutral" };

const fmt = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const range = (r: LeaveRow) => (r.startDate === r.endDate ? fmt(r.startDate) : `${fmt(r.startDate)} – ${fmt(r.endDate)}`);

interface Props {
  rows: LeaveRow[];
  leaveTypes: LeaveTypeOption[];
  myRequests: { id: string; startDate: string; endDate: string; status: string }[];
  today: string;
  canRequest: boolean;
  loadError: boolean;
}

export default function LeaveClient({ rows, leaveTypes, myRequests, today, canRequest, loadError }: Props) {
  const { toasts, notify } = useToasts();
  const [status, setStatus] = useState<"all" | LeaveStatus>("all");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [requesting, setRequesting] = useState(false);
  const [rejecting, setRejecting] = useState<LeaveRow | null>(null);
  const [revoking, setRevoking] = useState<LeaveRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const typeOf = useMemo(() => new Map(leaveTypes.map((t) => [t.code, t])), [leaveTypes]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);
  const toReview = rows.filter((r) => r.decidable).length;
  const upcomingDays = rows.filter((r) => r.status === "approved" && r.endDate >= today).reduce((n, r) => n + dayCount(r.startDate < today ? today : r.startDate, r.endDate), 0);

  // Pending first (oldest request first, so nobody waits longest), then newest decisions.
  const filtered = useMemo(() => {
    const list = rows.filter((r) => status === "all" || r.status === status);
    return list.sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || (a.status === "pending" ? (a.createdAt < b.createdAt ? -1 : 1) : a.startDate < b.startDate ? 1 : -1));
  }, [rows, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);

  const run = (id: string, work: () => Promise<{ ok: boolean; message?: string }>, success?: string) => {
    setBusy(id);
    startTransition(async () => {
      const res = await work();
      setBusy(null);
      if (res.ok) {
        if (success) notify("success", success);
      } else notify("error", res.message ?? "Couldn't save. Please try again.");
    });
  };
  const approve = (r: LeaveRow) =>
    run(r.id, async () => {
      const res = await decideLeave(r.id, "approved");
      if (res.ok) notify("success", `Approved ${res.data.days} day${res.data.days === 1 ? "" : "s"} for ${displayName(r.userName)}${res.data.replaced ? `. ${res.data.replaced} scheduled shift${res.data.replaced === 1 ? " was" : "s were"} replaced.` : ""}`);
      return res;
    });
  const cancel = (r: LeaveRow) => run(r.id, () => cancelLeave(r.id), "Request cancelled");

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave</h1>
          <p className="page-subtitle">Request time off and approve requests. Approved leave goes straight onto the roster.</p>
        </div>
        {canRequest && (
          <button type="button" className="btn btn-primary btn-lg fab" onClick={() => setRequesting(true)}>
            <PlusIcon size={16} /> Request leave
          </button>
        )}
      </div>

      {loadError && <div className="alert alert-danger" role="alert"><AlertIcon /> Couldn&apos;t load leave requests. Please refresh. If it keeps happening, contact an administrator.</div>}
      {!canRequest && <div className="alert alert-info" role="status">Leave requests need a signed-in person, so this session can only view them.</div>}

      <div className="stats-grid stats-compact">
        <StatCard label="To review" value={toReview} hint={toReview ? "Waiting for a decision" : "Nothing waiting"} color="var(--accent-amber)" icon={<ClockIcon size={18} />} />
        <StatCard label="Pending" value={counts.pending ?? 0} hint="Not decided yet" color="var(--accent-indigo)" icon={<CalendarIcon size={18} />} />
        <StatCard label="Approved days ahead" value={upcomingDays} hint="From today onwards" color="var(--accent-emerald)" icon={<CheckIcon size={18} />} />
      </div>

      <div className="toolbar">
        <div role="group" aria-label="Filter by status" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["all", ...LEAVE_STATUSES] as const).map((s) => (
            <button key={s} type="button" className="filter-pill" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }}>
              {s === "all" ? "All" : LEAVE_STATUS_LABEL[s]} · {counts[s] ?? 0}
            </button>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{filtered.length} requests</p>

      <div className="table-card">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>{rows.length === 0 ? "No leave requests yet" : "No requests match"}</h3>
            <p>{rows.length === 0 ? (canRequest ? "Ask for time off and your approver is told here." : "Requests will show here.") : "Try another status."}</p>
            {rows.length === 0 && canRequest && <button type="button" className="btn btn-primary" onClick={() => setRequesting(true)}><PlusIcon size={16} /> Request leave</button>}
          </div>
        ) : (
          <table className="data-table card-table">
            <thead>
              <tr><th scope="col">Person</th><th scope="col">Dates</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Note</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const n = dayCount(r.startDate, r.endDate);
                const t = typeOf.get(r.code);
                return (
                  <tr key={r.id}>
                    <td data-label="Person"><b>{displayName(r.userName)}</b>{r.mine && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>You</span>}</td>
                    <td data-label="Dates">{range(r)} · {n} day{n === 1 ? "" : "s"}</td>
                    <td data-label="Type"><span className="badge badge-indigo">{r.code}{t ? ` · ${t.label}` : ""}</span></td>
                    <td data-label="Status">
                      <span className={`badge ${BADGE[r.status]}`}>{LEAVE_STATUS_LABEL[r.status]}</span>
                      {r.decidedByName && r.status !== "pending" && r.status !== "cancelled" && <span className="muted"> by {displayName(r.decidedByName)}</span>}
                    </td>
                    <td data-label="Note" className="leave-note">{[r.note, r.decisionNote && (r.decisionNote.startsWith("Shortened") ? r.decisionNote : `Reply: ${r.decisionNote}`)].filter(Boolean).join(" · ") || "—"}</td>
                    <td data-label="" className="card-actions">
                      <div className="row-actions">
                        {r.decidable && <>
                          <button type="button" className="btn btn-primary" disabled={busy === r.id} onClick={() => approve(r)} aria-label={`Approve leave for ${displayName(r.userName)}`}>{busy === r.id ? "Working…" : "Approve"}</button>
                          <button type="button" className="btn" disabled={busy === r.id} onClick={() => setRejecting(r)} aria-label={`Reject leave for ${displayName(r.userName)}`}>Reject</button>
                        </>}
                        {r.revocable && <button type="button" className="btn" disabled={busy === r.id} onClick={() => setRevoking(r)} aria-label={`${r.mine ? "Cancel" : "Revoke"} approved leave for ${displayName(r.userName)}`}>{r.mine ? "Cancel leave" : "Revoke"}</button>}
                        {r.mine && r.status === "pending" && <button type="button" className="btn" disabled={busy === r.id} onClick={() => cancel(r)}>Cancel request</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {filtered.length > 0 && <Pagination page={safePage} size={size} total={filtered.length} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />}

      {requesting && <RequestDialog leaveTypes={leaveTypes} myRequests={myRequests} today={today} onClose={() => setRequesting(false)} onDone={(m) => { setRequesting(false); notify("success", m); }} />}
      {rejecting && <RejectDialog row={rejecting} onClose={() => setRejecting(null)} onDone={(m) => { setRejecting(null); notify("success", m); }} />}
      {revoking && <RevokeDialog row={revoking} today={today} onClose={() => setRevoking(null)} onDone={(m) => { setRevoking(null); notify("success", m); }} />}
      <ToastRegion toasts={toasts} />
    </div>
  );
}
