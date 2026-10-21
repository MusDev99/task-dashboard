"use client";

import { useRef, useState, useTransition } from "react";
import { saveSetting } from "../../lib/settings-actions";
import { cleanEntity, keyOf, shiftHours, validateEntity, type SettingErrors, type SettingRecord } from "../../lib/settings-validation";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { CloseIcon } from "../components/ui/Icons";
import { useFocusTrap } from "../components/ui/useFocusTrap";
import { COLOR_PRESETS, type EntityDef, type FieldDef } from "./entities";

interface Props {
  def: EntityDef;
  record: SettingRecord | null; // null = create
  /** Records to check uniqueness against (for roster codes: shifts AND leave types). */
  siblings: SettingRecord[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

type Form = Record<string, string | boolean>;
const toForm = (r: SettingRecord): Form => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "boolean" ? v : Number.isNaN(v) ? "" : String(v)]));

export default function EntityDrawer({ def, record, siblings, onClose, onSaved }: Props) {
  const originalKey = record ? keyOf(def.kind, record) : null;
  const [initial] = useState<Form>(() => toForm(record ?? def.defaults));
  const [form, setForm] = useState<Form>(initial);
  const [hoursTouched, setHoursTouched] = useState(!!record);
  const [errors, setErrors] = useState<SettingErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const requestClose = () => (dirty && !pending ? setConfirmDiscard(true) : onClose());
  useFocusTrap(ref, () => !confirmDiscard && requestClose());

  const validate = (f: Form) => validateEntity(def.kind, { ...cleanEntity(def.kind, f), ...(originalKey && def.kind === "status" ? { key: originalKey } : {}) }, siblings, originalKey);
  const set = (key: string, value: string | boolean) => {
    const next = { ...form, [key]: value };
    // Tesler: work out paid hours from the times unless the admin set them by hand.
    if (def.kind === "shift" && (key === "start" || key === "end") && !hoursTouched) {
      const h = shiftHours(String(next.start), String(next.end));
      if (h != null) next.hours = String(h);
    }
    if (key === "hours") setHoursTouched(true);
    // Suggest a status key from its name while creating.
    if (def.kind === "status" && key === "label" && !originalKey && !touched.has("key")) {
      next.key = String(value).toLowerCase().trim().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
    }
    setForm(next);
    if (touched.has(key) || errors[key]) setErrors(validate(next));
  };
  const blur = (key: string) => {
    setTouched((t) => new Set(t).add(key));
    setErrors(validate(form));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setTouched(new Set(Object.keys(form)));
    const first = def.fields.find((f) => found[f.key])?.key ?? Object.keys(found)[0];
    if (first) {
      ref.current?.querySelector<HTMLElement>(`#s-${first}`)?.focus();
      if (!def.fields.some((f) => f.key === first)) setServerError(found[first]);
      return;
    }
    setServerError(null);
    start(async () => {
      const res = await saveSetting(def.kind, originalKey, form);
      if (res.ok) onSaved(res.message);
      else {
        if (res.errors) setErrors(res.errors);
        setServerError(res.message ?? (res.errors ? Object.entries(res.errors).filter(([k]) => !def.fields.some((f) => f.key === k)).map(([, v]) => v)[0] ?? "Please fix the highlighted fields." : null));
      }
    });
  };

  const input = (f: FieldDef) => {
    const err = touched.has(f.key) || errors[f.key] ? errors[f.key] : undefined;
    const locked = !!(f.immutable && originalKey);
    const common = {
      id: `s-${f.key}`,
      "aria-invalid": err ? true : undefined,
      "aria-describedby": err ? `se-${f.key}` : f.hint ? `sh-${f.key}` : undefined,
      onBlur: () => blur(f.key),
      disabled: locked,
    } as const;
    const value = String(form[f.key] ?? "");

    if (f.type === "checkbox") {
      return (
        <div key={f.key} className="toggle-row">
          <div>
            <label htmlFor={`s-${f.key}`} style={{ fontWeight: 600, fontSize: "0.9rem", display: "block" }}>{f.label}</label>
            {f.hint && <span id={`sh-${f.key}`} className="field-hint">{f.hint}</span>}
            {err && <span id={`se-${f.key}`} className="field-error" role="alert" style={{ display: "block" }}>{err}</span>}
          </div>
          <input {...common} type="checkbox" role="switch" className="toggle" checked={form[f.key] === true} onChange={(e) => set(f.key, e.target.checked)} />
        </div>
      );
    }
    return (
      <div key={f.key} className="field">
        <label htmlFor={`s-${f.key}`}>{f.label}{f.required && <span className="req" aria-hidden="true"> *</span>}</label>
        {f.type === "select" ? (
          <select {...common} className="select" style={{ minHeight: "var(--touch)" }} value={value} onChange={(e) => set(f.key, e.target.value)}>
            {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : f.type === "textarea" ? (
          <textarea {...common} className="input textarea" rows={2} value={value} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
        ) : f.type === "color" ? (
          <div className="color-field">
            <input {...common} type="color" className="color-input" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#8b8da3"} onChange={(e) => set(f.key, e.target.value)} aria-label={`${f.label} picker`} />
            <div className="swatches" role="group" aria-label="Preset colours">
              {COLOR_PRESETS.map((c) => (
                <button key={c} type="button" className={`swatch ${value.toLowerCase() === c ? "is-on" : ""}`} style={{ background: c }} aria-label={`Use colour ${c}`} aria-pressed={value.toLowerCase() === c} onClick={() => set(f.key, c)} />
              ))}
            </div>
          </div>
        ) : (
          <input
            {...common}
            className="input"
            type={f.type === "number" ? "number" : f.type === "time" ? "time" : "text"}
            step={f.key === "hours" ? "0.25" : undefined}
            inputMode={f.type === "number" ? "decimal" : undefined}
            value={value}
            placeholder={f.placeholder}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )}
        {err ? <span id={`se-${f.key}`} className="field-error" role="alert">{err}</span> : f.hint ? <span id={`sh-${f.key}`} className="field-hint">{locked ? "Can't be changed after creation." : f.hint}</span> : null}
      </div>
    );
  };

  // Lay out `half` fields two per row.
  const rows: FieldDef[][] = [];
  for (const f of def.fields) {
    const last = rows[rows.length - 1];
    if (f.half && last && last.length === 1 && last[0].half) last.push(f);
    else rows.push([f]);
  }
  const noun = def.addLabel.replace(/^Add /, "");

  return (
    <>
      <div className="overlay" onClick={requestClose} />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby="sd-title">
        <div className="drawer-head">
          <h2 id="sd-title">{record ? `Edit ${noun}` : def.addLabel}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={requestClose}><CloseIcon /></button>
        </div>
        <form onSubmit={submit} noValidate style={{ display: "contents" }}>
          <div className="drawer-body">
            {serverError && <div className="alert alert-danger" role="alert">{serverError}</div>}
            {rows.map((r, i) => (r.length === 2 ? <div key={i} className="field-row">{r.map(input)}</div> : input(r[0])))}
          </div>
          <div className="drawer-foot">
            <button type="button" className="btn" onClick={requestClose} disabled={pending}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : record ? "Save changes" : def.addLabel}</button>
          </div>
        </form>
      </div>
      {confirmDiscard && (
        <ConfirmDialog title="Discard changes?" confirmLabel="Discard" danger onConfirm={onClose} onCancel={() => setConfirmDiscard(false)}>
          You have unsaved changes that will be lost.
        </ConfirmDialog>
      )}
    </>
  );
}
