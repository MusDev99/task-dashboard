"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { createTeam, updateTeam } from "../../lib/team-actions";
import { cleanTeamInput, validateTeam, type TeamErrors } from "../../lib/team-validation";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ColorField, { COLOR_PRESETS } from "../components/ui/ColorField";
import Avatar from "../components/ui/Avatar";
import { CloseIcon, CrownIcon, PlusIcon, SearchIcon } from "../components/ui/Icons";
import { useFocusTrap } from "../components/ui/useFocusTrap";
import { displayName } from "../lib/ui";
import { fmtDate } from "./TeamTable";
import type { TeamInput, TeamPerson, TeamRow } from "./types";

interface Props {
  mode: "add" | "edit";
  team?: TeamRow;
  allTeams: TeamRow[];
  people: TeamPerson[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

type Step = 1 | 2;
const STEP_FIELDS: Record<Step, (keyof TeamInput)[]> = { 1: ["name", "description", "color"], 2: ["memberIds", "leadId"] };
const MAX_RESULTS = 8;

const sub = (p: TeamPerson) => [p.employeeId, p.locationName].filter(Boolean).join(" · ") || p.email;

export default function TeamDrawer({ mode, team, allTeams, people, onClose, onSaved }: Props) {
  const initial: TeamInput = team
    ? { name: team.name, description: team.description, color: team.color, leadId: team.leadId ?? "", memberIds: team.memberIds }
    : { name: "", description: "", color: COLOR_PRESETS[allTeams.length % COLOR_PRESETS.length], leadId: "", memberIds: [] };
  const [form, setForm] = useState<TeamInput>(initial);
  const [step, setStep] = useState<Step>(1);
  const [errors, setErrors] = useState<TeamErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const requestClose = () => (dirty && !pending ? setConfirmDiscard(true) : onClose());
  useFocusTrap(ref, () => !confirmDiscard && requestClose());

  const validate = (f: TeamInput) => validateTeam(cleanTeamInput(f), people, allTeams, team);
  const set = <K extends keyof TeamInput>(key: K, value: TeamInput[K]) => {
    const next = { ...form, [key]: value };
    // A lead who is removed from the team stops being the lead.
    if (key === "memberIds" && next.leadId && !next.memberIds.includes(next.leadId)) next.leadId = "";
    setForm(next);
    if (touched.size) setErrors(validate(next));
  };
  const blur = (key: keyof TeamInput) => {
    setTouched((t) => new Set(t).add(key));
    setErrors(validate(form));
  };
  const err = (key: keyof TeamInput) => (touched.has(key) || errors[key] ? errors[key] : undefined);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const members = form.memberIds.map((id) => byId.get(id)).filter((p): p is TeamPerson => !!p);
  // Lead first, then A–Z.
  const ordered = [...members].sort((a, b) => Number(b.id === form.leadId) - Number(a.id === form.leadId) || displayName(a.name).localeCompare(displayName(b.name)));
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return people
      .filter((p) => p.isActive && !form.memberIds.includes(p.id))
      .filter((p) => [p.name, p.email, p.employeeId, p.locationName].some((v) => v?.toLowerCase().includes(needle)))
      .slice(0, MAX_RESULTS);
  }, [people, q, form.memberIds]);

  const add = (id: string) => {
    set("memberIds", [...form.memberIds, id]);
    setQ("");
    searchRef.current?.focus();
  };
  const remove = (id: string) => set("memberIds", form.memberIds.filter((m) => m !== id));
  const toggleLead = (id: string) => set("leadId", form.leadId === id ? "" : id);

  /** Marks a step's fields touched and returns its first error field, if any. */
  const check = (s: Step, found: TeamErrors) => {
    setTouched((t) => new Set([...t, ...STEP_FIELDS[s]]));
    return STEP_FIELDS[s].find((k) => found[k]);
  };
  const focusField = (key: keyof TeamInput) => requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`#t-${key}`)?.focus());

  const goTo = (s: Step) => {
    setStep(s);
    if (s === 2) requestAnimationFrame(() => searchRef.current?.focus());
  };
  const next = () => {
    const found = validate(form);
    setErrors(found);
    const bad = check(1, found);
    if (bad) return focusField(bad);
    goTo(2);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "add" && step === 1) return next(); // Enter on step 1 moves on
    const found = validate(form);
    setErrors(found);
    const bad1 = check(1, found);
    const bad2 = check(2, found);
    if (bad1) { setStep(1); return focusField(bad1); }
    if (bad2) { setStep(2); return focusField(bad2 === "memberIds" ? "memberIds" : "leadId"); }

    setServerError(null);
    startTransition(async () => {
      const res = mode === "add" ? await createTeam(form) : await updateTeam(team!.id, form);
      if (res.ok) {
        const n = cleanTeamInput(form).memberIds.length;
        onSaved(mode === "add" ? `Created ${res.data.name} with ${n} member${n === 1 ? "" : "s"}` : `Saved changes to ${res.data.name}`);
      } else {
        if (res.errors) {
          setErrors(res.errors);
          if (STEP_FIELDS[1].some((k) => res.errors?.[k])) setStep(1);
        }
        setServerError(res.message ?? (res.errors ? "Please fix the highlighted fields." : null));
      }
    });
  };

  const fieldError = (key: keyof TeamInput) => {
    const e = err(key);
    return e ? <span id={`te-${key}`} className="field-error" role="alert">{e}</span> : null;
  };
  const stepHasError = (s: Step) => STEP_FIELDS[s].some((k) => err(k));

  return (
    <>
      <div className="overlay" onClick={requestClose} />
      <div ref={ref} className="drawer team-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="drawer-head">
          <div>
            <h2 id="drawer-title">{mode === "add" ? "New team" : "Edit team"}</h2>
            <p className="drawer-sub">{team ? `Created ${fmtDate(team.createdAt)} · updated ${fmtDate(team.updatedAt)}` : "Name the team, then add its members."}</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={requestClose}><CloseIcon /></button>
        </div>

        <div className="stepper" role="tablist" aria-label="Steps">
          {([1, 2] as const).map((s) => (
            <button
              key={s} type="button" role="tab" id={`step-${s}`} aria-selected={step === s} aria-controls={`panel-${s}`}
              className={`step ${step === s ? "is-active" : ""} ${stepHasError(s) ? "has-error" : ""}`}
              onClick={() => (s === 2 && mode === "add" && step === 1 ? next() : goTo(s))}
            >
              <span className="step-num" aria-hidden="true">{s}</span>
              {s === 1 ? "Team details" : `Members${form.memberIds.length ? ` (${form.memberIds.length})` : ""}`}
              {stepHasError(s) && <span className="sr-only"> (has errors)</span>}
            </button>
          ))}
        </div>

        <form onSubmit={submit} noValidate style={{ display: "contents" }}>
          <div className="drawer-body">
            {serverError && <div className="alert alert-danger" role="alert">{serverError}</div>}

            <div role="tabpanel" id="panel-1" aria-labelledby="step-1" hidden={step !== 1} className="step-panel">
              <div className="field">
                <label htmlFor="t-name">Team name<span className="req" aria-hidden="true"> *</span></label>
                <input
                  id="t-name" className="input" value={form.name} placeholder="e.g. IT Assist" autoComplete="off" required autoFocus
                  aria-invalid={err("name") ? true : undefined} aria-describedby={err("name") ? "te-name" : undefined}
                  onChange={(e) => set("name", e.target.value)} onBlur={() => blur("name")}
                />
                {fieldError("name")}
              </div>
              <div className="field">
                <label htmlFor="t-description">Description</label>
                <textarea
                  id="t-description" className="input textarea" rows={3} value={form.description} placeholder="What this team works on (optional)"
                  aria-invalid={err("description") ? true : undefined} aria-describedby={err("description") ? "te-description" : undefined}
                  onChange={(e) => set("description", e.target.value)} onBlur={() => blur("description")}
                />
                {fieldError("description")}
              </div>
              <div className="field">
                <label htmlFor="t-color">Colour</label>
                <ColorField id="t-color" label="Colour" value={form.color} onChange={(v) => set("color", v)} onBlur={() => blur("color")} invalid={!!err("color")} describedBy={err("color") ? "te-color" : "th-color"} />
                {fieldError("color") ?? <span id="th-color" className="field-hint">Used for the team&apos;s card and chips.</span>}
              </div>
            </div>

            <div role="tabpanel" id="panel-2" aria-labelledby="step-2" hidden={step !== 2} className="step-panel">
              <div className="field">
                <label htmlFor="t-memberIds">Add members</label>
                <span className="field-hint" id="th-memberIds">Any active user can be added, and a person can be in several teams. Search by name, employee ID, email or location.</span>
                <div className="member-search">
                  <div className="search-wrap">
                    <SearchIcon size={16} />
                    <input
                      ref={searchRef} id="t-memberIds" className="search-input" type="search" placeholder="Search users to add…" value={q} autoComplete="off"
                      aria-invalid={err("memberIds") ? true : undefined} aria-describedby={err("memberIds") ? "te-memberIds th-memberIds" : "th-memberIds"}
                      aria-controls="member-results" aria-expanded={!!q.trim()}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (results[0]) add(results[0].id); } }}
                    />
                  </div>
                  {q.trim() && (
                    <ul id="member-results" className="member-results" aria-label="Matching users">
                      {results.map((p) => (
                        <li key={p.id}>
                          <button type="button" className="member-result" onClick={() => add(p.id)}>
                            <Avatar id={p.id} name={p.name} src={p.avatar} size="sm" />
                            <span className="team-person-main"><b>{displayName(p.name)}</b><small>{sub(p)}</small></span>
                            <PlusIcon size={16} />
                            <span className="sr-only">Add</span>
                          </button>
                        </li>
                      ))}
                      {results.length === 0 && <li className="field-hint" style={{ padding: "0.6rem 0.75rem" }}>No one else matches.</li>}
                    </ul>
                  )}
                </div>
                {fieldError("memberIds")}
              </div>

              <div className="field">
                <div className="team-card-section-head">
                  <span className="member-heading" id="members-heading">Team members ({members.length})</span>
                  {members.length > 0 && <span className="field-hint">Tap the crown to set the lead</span>}
                </div>
                {members.length === 0 ? (
                  <p className="member-empty">No members yet. Search above to add people.</p>
                ) : (
                  <ul className="member-cards" aria-labelledby="members-heading">
                    {ordered.map((p) => {
                      const isLead = form.leadId === p.id;
                      return (
                        <li key={p.id} className={`member-card ${isLead ? "is-lead" : ""}`}>
                          <Avatar id={p.id} name={p.name} src={p.avatar} size="sm" />
                          <span className="team-person-main">
                            <b>{displayName(p.name)}{p.isActive ? "" : " (inactive)"}</b>
                            <small>{isLead ? "Team lead · " : ""}{sub(p)}</small>
                          </span>
                          <button
                            type="button" id={isLead ? "t-leadId" : undefined} className={`icon-btn lead-toggle ${isLead ? "is-on" : ""}`}
                            aria-pressed={isLead} aria-label={isLead ? `${displayName(p.name)} is the lead. Remove as lead` : `Make ${displayName(p.name)} the lead`}
                            title={isLead ? "Remove as lead" : "Make lead"} onClick={() => toggleLead(p.id)}
                          >
                            <CrownIcon size={17} />
                          </button>
                          <button type="button" className="icon-btn icon-btn-danger" aria-label={`Remove ${displayName(p.name)}`} title="Remove" onClick={() => remove(p.id)}>
                            <CloseIcon size={17} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {fieldError("leadId")}
              </div>
            </div>
          </div>

          <div className="drawer-foot">
            {step === 1 ? (
              <button type="button" className="btn" onClick={requestClose} disabled={pending}>Cancel</button>
            ) : (
              <button type="button" className="btn" onClick={() => goTo(1)} disabled={pending}>Back</button>
            )}
            {step === 1 && mode === "add" ? (
              <button type="submit" className="btn btn-primary">Next: members</button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : mode === "add" ? "Create team" : "Save changes"}</button>
            )}
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
