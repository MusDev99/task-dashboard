"use client";

import { useRef, useState, useTransition } from "react";
import { createUser, updateUser } from "../../lib/user-actions";
import { cleanUserInput, validateUserInput, type FieldErrors, type UserInput } from "../../lib/validation";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Avatar from "../components/ui/Avatar";
import { CloseIcon } from "../components/ui/Icons";
import { useFocusTrap } from "../components/ui/useFocusTrap";
import type { Option, UserOptions, UserRow } from "./types";
import { ACCESS_LABELS, ACCESS_LEVELS, parseAccess } from "../../lib/access";

interface Props {
  mode: "add" | "edit";
  user?: UserRow;
  allUsers: UserRow[];
  options: UserOptions;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const empty: UserInput = { name: "", email: "", employeeId: "", locationId: "", phoneNumber: "", roleId: "", avatar: "", isActive: true, access: "member" };

export default function UserDrawer({ mode, user, allUsers, options, onClose, onSaved }: Props) {
  const initial: UserInput = user
    ? { name: user.name, email: user.email, employeeId: user.employeeId ?? "", locationId: user.locationId ?? "", phoneNumber: user.phoneNumber ?? "", roleId: user.roleId ?? "", avatar: user.avatar ?? "", isActive: user.isActive, access: user.access }
    : empty;
  const [form, setForm] = useState<UserInput>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const requestClose = () => (dirty && !pending ? setConfirmDiscard(true) : onClose());
  useFocusTrap(ref, () => !confirmDiscard && requestClose());

  const refs = {
    activeLocationIds: new Set(options.locations.filter((o) => o.active).map((o) => o.id)),
    activeRoleIds: new Set(options.roles.filter((o) => o.active).map((o) => o.id)),
  };
  const validate = (f: UserInput) => validateUserInput(cleanUserInput(f), allUsers, refs, user?.id);
  const set = <K extends keyof UserInput>(key: K, value: UserInput[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched.has(key)) setErrors(validate(next));
  };
  const blur = (key: keyof UserInput) => {
    setTouched((t) => new Set(t).add(key));
    setErrors(validate(form));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setTouched(new Set(Object.keys(form)));
    const firstBad = (Object.keys(found) as (keyof UserInput)[])[0];
    if (firstBad) return ref.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();

    setServerError(null);
    startTransition(async () => {
      const res = mode === "add" ? await createUser(form) : await updateUser(user!.id, form);
      if (res.ok) {
        const name = cleanUserInput(form).name;
        const level = ACCESS_LABELS[parseAccess(form.access)].label;
        onSaved(mode === "add" ? `Added ${name} as ${level}` : form.access !== initial.access ? `${name} is now ${level === "Admin" ? "an" : "a"} ${level}` : `Saved changes to ${name}`);
      } else {
        if (res.errors) setErrors(res.errors);
        setServerError(res.message ?? (res.errors ? "Please fix the highlighted fields." : null));
      }
    });
  };

  const field = (key: keyof UserInput, label: string, opts: { required?: boolean; type?: string; hint?: string; placeholder?: string; autoComplete?: string } = {}) => {
    const err = touched.has(key) || errors[key] ? errors[key] : undefined;
    return (
      <div className="field">
        <label htmlFor={`f-${key}`}>{label}{opts.required && <span className="req" aria-hidden="true"> *</span>}</label>
        <input
          id={`f-${key}`} name={key} className="input" type={opts.type ?? "text"} value={String(form[key])}
          placeholder={opts.placeholder} autoComplete={opts.autoComplete ?? "off"} required={opts.required}
          aria-invalid={err ? true : undefined} aria-describedby={err ? `e-${key}` : opts.hint ? `h-${key}` : undefined}
          onChange={(e) => set(key, e.target.value as never)} onBlur={() => blur(key)}
        />
        {err ? <span id={`e-${key}`} className="field-error" role="alert">{err}</span> : opts.hint ? <span id={`h-${key}`} className="field-hint">{opts.hint}</span> : null}
      </div>
    );
  };

  /** Select from a Settings list: active options, plus the current value if it was deactivated since. */
  const select = (key: "locationId" | "roleId", label: string, list: Option[], none: string) => {
    const err = touched.has(key) || errors[key] ? errors[key] : undefined;
    const current = initial[key];
    const choices = list.filter((o) => o.active || o.id === current);
    return (
      <div className="field">
        <label htmlFor={`f-${key}`}>{label}</label>
        <select
          id={`f-${key}`} name={key} className="select" style={{ minHeight: "var(--touch)" }} value={form[key]}
          aria-invalid={err ? true : undefined} aria-describedby={err ? `e-${key}` : undefined}
          onChange={(e) => set(key, e.target.value)} onBlur={() => blur(key)}
        >
          <option value="">{none}</option>
          {choices.map((o) => <option key={o.id} value={o.id}>{o.name}{o.active ? "" : " (inactive)"}</option>)}
        </select>
        {err ? <span id={`e-${key}`} className="field-error" role="alert">{err}</span> : list.length === 0 ? <span className="field-hint">Add {label.toLowerCase()}s in Settings.</span> : null}
      </div>
    );
  };

  return (
    <>
      <div className="overlay" onClick={requestClose} />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <h2 id="drawer-title">{mode === "add" ? "Add user" : "Edit user"}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={requestClose}><CloseIcon /></button>
        </div>
        <form onSubmit={submit} noValidate style={{ display: "contents" }}>
          <div className="drawer-body">
            {serverError && <div className="alert alert-danger" role="alert">{serverError}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar id={user?.id ?? "new"} name={form.name || "?"} src={form.avatar.startsWith("https://") ? form.avatar : null} size="lg" />
              <span className="field-hint">{mode === "add" ? "ID and join date are generated automatically." : `Joined ${user?.joinedDate.slice(0, 10)} · ID is read-only.`}</span>
            </div>
            {field("name", "Full name", { required: true, placeholder: "e.g. Aisyah Rahman", autoComplete: "name" })}
            {field("email", "Email", { required: true, type: "email", placeholder: "name@airasia.com", autoComplete: "email" })}
            <div className="field-row">
              {field("employeeId", "Employee ID")}
              {select("locationId", "Location", options.locations, "No location")}
            </div>
            <div className="field-row">
              {field("phoneNumber", "Phone", { type: "tel", placeholder: "+60 12-345 6789" })}
              {select("roleId", "Role", options.roles, "No role")}
            </div>
            <div className="field">
              <label htmlFor="f-access">Access level</label>
              <select
                id="f-access" name="access" className="select" style={{ minHeight: "var(--touch)" }} value={form.access}
                aria-invalid={errors.access ? true : undefined} aria-describedby={errors.access ? "e-access" : "h-access"}
                onChange={(e) => set("access", e.target.value)} onBlur={() => blur("access")}
              >
                {ACCESS_LEVELS.map((l) => <option key={l} value={l}>{ACCESS_LABELS[l].label}</option>)}
              </select>
              {errors.access
                ? <span id="e-access" className="field-error" role="alert">{errors.access}</span>
                : <span id="h-access" className="field-hint">{ACCESS_LABELS[parseAccess(form.access)].hint}. Separate from the job role.</span>}
            </div>
            {field("avatar", "Avatar URL", { type: "url", placeholder: "https://…", hint: "Optional. Must be an https:// image link." })}
            <div className="toggle-row">
              <div>
                <label htmlFor="f-isActive" style={{ fontWeight: 600, fontSize: "0.9rem", display: "block" }}>Active</label>
                <span className="field-hint">Inactive users stay in the system but are flagged.</span>
              </div>
              <input id="f-isActive" name="isActive" type="checkbox" role="switch" className="toggle" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            </div>
          </div>
          <div className="drawer-foot">
            <button type="button" className="btn" onClick={requestClose} disabled={pending}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : mode === "add" ? "Add user" : "Save changes"}</button>
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
