"use client";

import { useMemo, useState, useTransition } from "react";
import { saveGeneral } from "../../lib/settings-actions";
import { validTimezone, validateGeneral, type SettingErrors } from "../../lib/settings-validation";
import type { AppSettings } from "../../lib/settings";

export default function GeneralForm({ settings, notify }: { settings: AppSettings; notify: (k: "success" | "error", t: string) => void }) {
  const initial = { timezone: settings.timezone, codePrefix: settings.codePrefix, weekStart: String(settings.weekStart), maxLabels: String(settings.maxLabels), maxLinks: String(settings.maxLinks) };
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
  const parsed = () => ({ ...form, codePrefix: form.codePrefix.trim().toUpperCase(), weekStart: Number(form.weekStart), maxLabels: Number(form.maxLabels), maxLinks: Number(form.maxLinks) });
  const set = (k: keyof typeof form, v: string) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (errors[k]) setErrors(validateGeneral({ ...next, codePrefix: next.codePrefix.toUpperCase(), weekStart: Number(next.weekStart), maxLabels: Number(next.maxLabels), maxLinks: Number(next.maxLinks) }));
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
        <div className="settings-form-foot">
          <button type="button" className="btn" disabled={!dirty || pending} onClick={() => { setForm(initial); setErrors({}); }}>Reset</button>
          <button type="submit" className="btn btn-primary" disabled={!dirty || pending}>{pending ? "Saving…" : "Save changes"}</button>
        </div>
      </form>
    </section>
  );
}
