"use client";

import { useMemo, useState, useTransition } from "react";
import { saveGeneral } from "../../lib/settings-actions";
import { validTimezone, validateGeneral, type SettingErrors } from "../../lib/settings-validation";
import type { AppSettings } from "../../lib/settings";

export default function GeneralForm({ settings, notify, readOnly = false }: { settings: AppSettings; notify: (k: "success" | "error", t: string) => void; readOnly?: boolean }) {
  const initial = { timezone: settings.timezone, codePrefix: settings.codePrefix, weekStart: String(settings.weekStart), maxLabels: String(settings.maxLabels), maxLinks: String(settings.maxLinks), maxConsecutiveDays: String(settings.maxConsecutiveDays), minRestHours: String(settings.minRestHours), maxWeeklyHours: String(settings.maxWeeklyHours) };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<SettingErrors>({});
  const [pending, start] = useTransition();
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone");
    } catch {
      return [];
    }
  }, []);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const parsed = () => ({ ...form, codePrefix: form.codePrefix.trim().toUpperCase(), weekStart: Number(form.weekStart), maxLabels: Number(form.maxLabels), maxLinks: Number(form.maxLinks), maxConsecutiveDays: Number(form.maxConsecutiveDays), minRestHours: Number(form.minRestHours), maxWeeklyHours: Number(form.maxWeeklyHours) });
  const set = (k: keyof typeof form, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (errors[k]) setErrors(validateGeneral({ ...next, codePrefix: next.codePrefix.toUpperCase(), weekStart: Number(next.weekStart), maxLabels: Number(next.maxLabels), maxLinks: Number(next.maxLinks), maxConsecutiveDays: Number(next.maxConsecutiveDays), minRestHours: Number(next.minRestHours), maxWeeklyHours: Number(next.maxWeeklyHours) }));
  };
  const now = validTimezone(form.timezone)
    ? new Intl.DateTimeFormat("en-GB", { timeZone: form.timezone, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date())
    : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateGeneral(parsed());
    setErrors(found);
    if (Object.keys(found).length) return document.getElementById(`g-${Object.keys(found)[0]}`)?.focus();
    start(async () => {
      const res = await saveGeneral(parsed());
      if (res.ok) notify("success", res.message);
      else {
        if (res.errors) setErrors(res.errors);
        notify("error", res.message ?? "Please fix the highlighted fields.");
      }
    });
  };

  const err = (k: string) => errors[k] && <span className="field-error" role="alert">{errors[k]}</span>;

  return (
    <section className="settings-section" aria-labelledby="sec-general">
      <div className="settings-section-head">
        <div>
          <h2 id="sec-general">General</h2>
          <p className="page-subtitle">Organisation-wide defaults used by the roster, dashboard and tasks.</p>
        </div>
      </div>
      <form className="table-card settings-form" onSubmit={submit} noValidate>
        <fieldset className="fieldset-plain" disabled={readOnly}>
        <div className="field">
          <label htmlFor="g-timezone">Time zone<span className="req" aria-hidden="true"> *</span></label>
          <input id="g-timezone" className="input" list="tz-list" value={form.timezone} aria-invalid={!!errors.timezone || undefined} onChange={(e) => set("timezone", e.target.value)} />
          <datalist id="tz-list">{zones.map((z) => <option key={z} value={z} />)}</datalist>
          {errors.timezone ? err("timezone") : <span className="field-hint">Decides what &ldquo;today&rdquo; is. {now && <>Now there: <b>{now}</b></>}</span>}
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="g-codePrefix">Task code prefix<span className="req" aria-hidden="true"> *</span></label>
            <input id="g-codePrefix" className="input" value={form.codePrefix} maxLength={5} aria-invalid={!!errors.codePrefix || undefined} onChange={(e) => set("codePrefix", e.target.value.toUpperCase())} />
            {errors.codePrefix ? err("codePrefix") : <span className="field-hint">New tasks get {form.codePrefix || "TSK"}-0001, …; existing codes don&apos;t change.</span>}
          </div>
          <div className="field">
            <label htmlFor="g-weekStart">Week starts on</label>
            <select id="g-weekStart" className="select" style={{ minHeight: "var(--touch)" }} value={form.weekStart} onChange={(e) => set("weekStart", e.target.value)}>
              <option value="1">Monday</option>
              <option value="0">Sunday</option>
            </select>
            {err("weekStart")}
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="g-maxLabels">Max labels per task</label>
            <input id="g-maxLabels" className="input" type="number" min={1} max={50} value={form.maxLabels} aria-invalid={!!errors.maxLabels || undefined} onChange={(e) => set("maxLabels", e.target.value)} />
            {err("maxLabels")}
          </div>
          <div className="field">
            <label htmlFor="g-maxLinks">Max links per task</label>
            <input id="g-maxLinks" className="input" type="number" min={1} max={50} value={form.maxLinks} aria-invalid={!!errors.maxLinks || undefined} onChange={(e) => set("maxLinks", e.target.value)} />
            {err("maxLinks")}
          </div>
        </div>
        <h3 className="settings-subhead">Roster rules</h3>
        <p className="field-hint">Warnings on the Roster when a schedule goes past these limits. They never block a change. Enter 0 to switch a rule off.</p>
        <div className="field-row field-row-3">
          <div className="field">
            <label htmlFor="g-maxConsecutiveDays">Max days in a row</label>
            <input id="g-maxConsecutiveDays" className="input" type="number" min={0} max={31} value={form.maxConsecutiveDays} aria-invalid={!!errors.maxConsecutiveDays || undefined} onChange={(e) => set("maxConsecutiveDays", e.target.value)} />
            {err("maxConsecutiveDays")}
          </div>
          <div className="field">
            <label htmlFor="g-minRestHours">Min rest between shifts (h)</label>
            <input id="g-minRestHours" className="input" type="number" min={0} max={24} step="0.5" value={form.minRestHours} aria-invalid={!!errors.minRestHours || undefined} onChange={(e) => set("minRestHours", e.target.value)} />
            {err("minRestHours")}
          </div>
          <div className="field">
            <label htmlFor="g-maxWeeklyHours">Max hours per week</label>
            <input id="g-maxWeeklyHours" className="input" type="number" min={0} max={168} step="0.5" value={form.maxWeeklyHours} aria-invalid={!!errors.maxWeeklyHours || undefined} onChange={(e) => set("maxWeeklyHours", e.target.value)} />
            {err("maxWeeklyHours")}
          </div>
        </div>
        </fieldset>
        {!readOnly && <div className="settings-form-foot">
          <button type="button" className="btn" disabled={!dirty || pending} onClick={() => { setForm(initial); setErrors({}); }}>Reset</button>
          <button type="submit" className="btn btn-primary" disabled={!dirty || pending}>{pending ? "Saving…" : "Save changes"}</button>
        </div>}
      </form>
    </section>
  );
}
