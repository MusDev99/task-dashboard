"use client";

import { useRef, useState, useTransition } from "react";
import { decideLeave, requestLeave, revokeLeave } from "../../lib/leave-actions";
import { MAX_LEAVE_DAYS, NOTE_MAX, cleanLeaveInput, dayBefore, dayCount, validateLeaveInput, type LeaveErrors, type LeaveInput } from "../../lib/leave";
import { useFocusTrap } from "../components/ui/useFocusTrap";
import type { LeaveRow, LeaveTypeOption } from "./types";

export function RequestDialog({ leaveTypes, myRequests, today, onClose, onDone }: {
  leaveTypes: LeaveTypeOption[];
  myRequests: { id: string; startDate: string; endDate: string; status: string }[];
  today: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const choices = leaveTypes.filter((t) => t.active);
  const [form, setForm] = useState<LeaveInput>({ startDate: today, endDate: today, code: choices[0]?.code ?? "", note: "" });
  const [errors, setErrors] = useState<LeaveErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, pending ? () => undefined : onClose);

  const check = (f: LeaveInput) => validateLeaveInput(cleanLeaveInput(f), { today, leaveCodes: leaveTypes, existing: myRequests });
  const days = dayCount(form.startDate, form.endDate || form.startDate);
  const set = (k: keyof LeaveInput, v: string) => {
    const next = { ...form, [k]: v };
    // Moving the start past the end drags the end along, so the common case (one day) needs a single pick.
    if (k === "startDate" && (!form.endDate || form.endDate < v)) next.endDate = v;
    setForm(next);
    if (Object.keys(errors).length) setErrors(check(next));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = check(form);
    setErrors(found);
    setServerError(null);
    const first = (["code", "startDate", "endDate", "note"] as const).find((k) => found[k]);
    if (first) return document.getElementById(`lv-${first}`)?.focus();
    start(async () => {
      const res = await requestLeave(form);
      if (res.ok) onDone(`Requested ${days} day${days === 1 ? "" : "s"} of leave`);
      else {
        if (res.errors) setErrors(res.errors);
        setServerError(res.message ?? "Please fix the highlighted fields.");
      }
    });
  };

  const err = (k: keyof LeaveInput) => errors[k] && <span className="field-error" role="alert">{errors[k]}</span>;

  return (
    <>
      <div className="overlay" style={{ zIndex: 110 }} onClick={pending ? undefined : onClose} />
      <div ref={ref} className="modal" style={{ zIndex: 120, width: "min(480px, calc(100vw - 2rem))" }} role="dialog" aria-modal="true" aria-labelledby="lv-title">
        <h2 id="lv-title">Request leave</h2>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="lv-code">Leave type<span className="req" aria-hidden="true"> *</span></label>
            <select id="lv-code" className="select" style={{ minHeight: "var(--touch)" }} value={form.code} aria-invalid={!!errors.code || undefined} onChange={(e) => set("code", e.target.value)}>
              {choices.length === 0 && <option value="">No leave types available</option>}
              {choices.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.label}</option>)}
            </select>
            {err("code")}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="lv-startDate">From<span className="req" aria-hidden="true"> *</span></label>
              <input id="lv-startDate" className="input" type="date" min={today} value={form.startDate} aria-invalid={!!errors.startDate || undefined} onChange={(e) => set("startDate", e.target.value)} />
              {err("startDate")}
            </div>
            <div className="field">
              <label htmlFor="lv-endDate">To<span className="req" aria-hidden="true"> *</span></label>
              <input id="lv-endDate" className="input" type="date" min={form.startDate || today} value={form.endDate} aria-invalid={!!errors.endDate || undefined} onChange={(e) => set("endDate", e.target.value)} />
              {err("endDate")}
            </div>
          </div>
          <p className="field-hint" aria-live="polite">{days > 0 ? `${days} calendar day${days === 1 ? "" : "s"} (max ${MAX_LEAVE_DAYS}). Weekends and holidays are included.` : "Pick the dates."}</p>
          <div className="field">
            <label htmlFor="lv-note">Note (optional)</label>
            <textarea id="lv-note" className="input" rows={2} maxLength={NOTE_MAX} value={form.note} aria-invalid={!!errors.note || undefined} onChange={(e) => set("note", e.target.value)} />
            {err("note")}
          </div>
          {serverError && <div className="alert alert-danger" role="alert">{serverError}</div>}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={pending}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={pending || choices.length === 0}>{pending ? "Sending…" : "Send request"}</button>
          </div>
        </form>
      </div>
    </>
  );
}

export function RejectDialog({ row, onClose, onDone }: { row: LeaveRow; onClose: () => void; onDone: (message: string) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, pending ? () => undefined : onClose);
  const confirm = () =>
    start(async () => {
      const res = await decideLeave(row.id, "rejected", note);
      if (res.ok) onDone(`Rejected the request from ${row.userName.replace(/\s-\s*$/, "")}`);
      else setError(res.message ?? "Couldn't reject the request.");
    });
  return (
    <>
      <div className="overlay" style={{ zIndex: 110 }} onClick={pending ? undefined : onClose} />
      <div ref={ref} className="modal" style={{ zIndex: 120, width: "min(460px, calc(100vw - 2rem))" }} role="dialog" aria-modal="true" aria-labelledby="rj-title">
        <h2 id="rj-title">Reject request</h2>
        <p>{row.userName.replace(/\s-\s*$/, "")} · {row.code} · {row.startDate} to {row.endDate}. Nothing changes on the roster.</p>
        <div className="field">
          <label htmlFor="rj-note">Reason (optional, shown to them)</label>
          <textarea id="rj-note" className="input" rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" autoFocus onClick={onClose} disabled={pending}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={pending}>{pending ? "Rejecting…" : "Reject"}</button>
        </div>
      </div>
    </>
  );
}

/** Confirm taking back approved leave, stating exactly what leaves the roster. Cancel is the default focus. */
export function RevokeDialog({ row, today, onClose, onDone }: { row: LeaveRow; today: string; onClose: () => void; onDone: (message: string) => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, pending ? () => undefined : onClose);

  const from = row.startDate > today ? row.startDate : today;
  const remaining = dayCount(from, row.endDate);
  const started = row.startDate < today;
  const label = row.mine ? "Cancel leave" : "Revoke leave";
  const who = row.userName.replace(/\s-\s*$/, "");

  const confirm = () =>
    start(async () => {
      const res = await revokeLeave(row.id, note);
      if (!res.ok) return setError(res.message ?? "Couldn't revoke the leave.");
      const { kind, cleared, untouched } = res.data;
      onDone(
        `${kind === "revoked" ? (row.mine ? "Leave cancelled" : "Leave revoked") : "Leave shortened"}: ${cleared} roster day${cleared === 1 ? "" : "s"} cleared${untouched ? `. ${untouched} day${untouched === 1 ? " was" : "s were"} changed since and left as they are.` : ""}`,
      );
    });

  return (
    <>
      <div className="overlay" style={{ zIndex: 110 }} onClick={pending ? undefined : onClose} />
      <div ref={ref} className="modal" style={{ zIndex: 120, width: "min(460px, calc(100vw - 2rem))" }} role="alertdialog" aria-modal="true" aria-labelledby="rv-title" aria-describedby="rv-body">
        <h2 id="rv-title">{row.mine ? "Cancel your approved leave?" : "Revoke approved leave?"}</h2>
        <p id="rv-body">
          {who} · {row.code} · {row.startDate} to {row.endDate}.{" "}
          This removes {row.code} from the roster for the <b style={{ color: "var(--text-primary)" }}>{remaining} remaining day{remaining === 1 ? "" : "s"}</b> ({from} to {row.endDate}).
          {started ? ` Days that have already passed stay, and the request will end on ${dayBefore(today)}.` : ""} Any of those days a planner has since changed are left as they are.
        </p>
        <div className="field">
          <label htmlFor="rv-note">Reason (optional{row.mine ? "" : ", shown to them"})</label>
          <textarea id="rv-note" className="input" rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" autoFocus onClick={onClose} disabled={pending}>Keep leave</button>
          <button type="button" className="btn btn-danger" onClick={confirm} disabled={pending}>{pending ? "Working…" : label}</button>
        </div>
      </div>
    </>
  );
}
