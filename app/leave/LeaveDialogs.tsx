"use client";

import { useRef, useState, useTransition } from "react";
import { decideLeave, requestLeave } from "../../lib/leave-actions";
import { MAX_LEAVE_DAYS, NOTE_MAX, cleanLeaveInput, dayCount, validateLeaveInput, type LeaveErrors, type LeaveInput } from "../../lib/leave";
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
