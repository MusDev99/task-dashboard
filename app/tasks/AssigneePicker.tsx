"use client";

import { useMemo, useRef, useState } from "react";
import Avatar from "../components/ui/Avatar";
import { useDismiss } from "../components/ui/useDismiss";
import { displayName } from "../lib/ui";
import type { Availability, Person } from "./types";
import type { TeamOption } from "../teams/types";

interface Props {
  people: Person[];
  teams: TeamOption[];
  value: string | null;
  availability: Map<string, Availability> | null; // null = loading
  hasWindow: boolean;
  onChange: (id: string | null) => void;
  invalid?: boolean;
}

function badge(a: Availability | undefined, hasWindow: boolean) {
  if (!a || !hasWindow) return { text: "Set dates to check", tone: "muted" };
  if (a.leave.length) return { text: `On leave · ${a.leave.map((l) => `${l.code} ${l.days}d`).join(", ")}`, tone: "warn" };
  if (a.workingDays === 0) return { text: "Not rostered", tone: "warn" };
  if (a.unscheduledDays > 0) return { text: `Working ${a.workingDays}/${a.totalDays}d · ${a.unscheduledDays}d unscheduled`, tone: "ok" };
  return { text: `Available · ${a.workingDays}d`, tone: "ok" };
}

/** Searchable assignee list showing roster availability + open workload. Unavailable people stay selectable. */
export default function AssigneePicker({ people, teams, value, availability, hasWindow, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [team, setTeam] = useState(""); // narrows the list only; the task stores a person, never a team
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const selected = people.find((p) => p.id === value);

  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const members = team ? new Set(teams.find((t) => t.id === team)?.memberIds ?? []) : null;
    // Active people only, plus the current assignee if they became inactive.
    return people
      .filter((p) => p.isActive || p.id === value)
      .filter((p) => !members || members.has(p.id) || p.id === value)
      .filter((p) => !needle || [p.name, p.email, p.employeeId].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => {
        // Available first, then by lowest open workload, then name.
        const wa = availability?.get(a.id)?.warning ? 1 : 0;
        const wb = availability?.get(b.id)?.warning ? 1 : 0;
        return wa - wb || (availability?.get(a.id)?.openPoints ?? 0) - (availability?.get(b.id)?.openPoints ?? 0) || a.name.localeCompare(b.name);
      });
  }, [people, teams, team, q, value, availability]);

  const choose = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="assignee-picker" ref={ref}>
      <button
        type="button"
        id="f-assigneeId"
        className="input assignee-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? (
          <><Avatar id={selected.id} name={selected.name} src={selected.avatar} size="sm" /><span>{displayName(selected.name)}</span></>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>Unassigned</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: "auto" }} aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="assignee-pop">
          <input className="input" autoFocus placeholder="Search people…" aria-label="Search people" value={q} onChange={(e) => setQ(e.target.value)} style={{ minHeight: 38 }} />
          {teams.length > 0 && (
            <select className="select assignee-team" aria-label="Show members of team" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">Everyone</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.memberIds.length})</option>)}
            </select>
          )}
          <div role="listbox" aria-label="Assignee" className="assignee-list">
            <button type="button" role="option" aria-selected={!value} className="assignee-option" onClick={() => choose(null)}>
              <span className="assignee-none">—</span><span className="assignee-option-main"><b>Unassigned</b></span>
            </button>
            {options.map((p) => {
              const a = availability?.get(p.id);
              const b = availability ? badge(a, hasWindow) : { text: "Checking…", tone: "muted" };
              return (
                <button key={p.id} type="button" role="option" aria-selected={p.id === value} className="assignee-option" onClick={() => choose(p.id)}>
                  <Avatar id={p.id} name={p.name} src={p.avatar} size="sm" />
                  <span className="assignee-option-main">
                    <b>{displayName(p.name)}</b>
                    <small className={`avail avail-${b.tone}`}>{b.text}</small>
                  </span>
                  <span className="assignee-load" title="Open story points / open tasks">{a ? `${a.openPoints} SP · ${a.openTasks}` : ""}</span>
                </button>
              );
            })}
            {options.length === 0 && <p className="field-hint" style={{ padding: "0.5rem" }}>No one matches.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
