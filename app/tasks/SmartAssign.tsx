"use client";

import { useState, useTransition } from "react";
import Avatar from "../components/ui/Avatar";
import { CheckIcon, SparkIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import { suggestAssignees } from "../../lib/smart-assign-actions";
import type { SuggestResult } from "../../lib/smart-assign";
import type { Person, TaskInput } from "./types";
import type { TeamOption } from "../teams/types";

interface Props {
  form: TaskInput;
  taskId: string | null;
  people: Person[];
  teams: TeamOption[];
  value: string | null;
  onPick: (id: string) => void;
}

/**
 * Smart assign (AI pilot): suggests up to 3 people with reasons; the person picks (never auto-assigns).
 * Hick: one secondary button, three choices. Doherty: skeleton while it thinks. Von Restorff: no second accent button.
 */
export default function SmartAssign({ form, taskId, people, teams, value, onPick }: Props) {
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [team, setTeam] = useState("");
  const [pending, start] = useTransition();

  const run = () => {
    setFailed(false);
    start(async () => {
      try {
        setResult(await suggestAssignees({ ...form, taskId, teamId: team || null }));
      } catch {
        setFailed(true);
      }
    });
  };

  return (
    <section className="smart-assign" aria-labelledby="smart-assign-title">
      <div className="smart-assign-head">
        <h3 id="smart-assign-title"><SparkIcon size={15} /> Smart assign</h3>
        {teams.length > 0 && (
          <select className="select smart-assign-team" aria-label="Suggest from team" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Everyone</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <button type="button" className="btn smart-assign-btn" onClick={run} disabled={pending} aria-describedby="smart-assign-hint">
          {pending ? "Thinking…" : result ? "Suggest again" : "Suggest"}
        </button>
      </div>
      {!result && !pending && !failed && (
        <p id="smart-assign-hint" className="field-hint">Ranks people by roster availability, open workload and past tasks. You choose.</p>
      )}

      <div aria-live="polite" aria-busy={pending}>
        {pending ? (
          <ul className="smart-list" aria-hidden="true">{[0, 1, 2].map((i) => <li key={i} className="smart-card skeleton smart-skeleton" />)}</ul>
        ) : failed ? (
          <p className="field-error" role="alert">Couldn&apos;t get suggestions. Please try again.</p>
        ) : result ? (
          <>
            <p className="field-hint smart-meta">
              <span className={`badge ${result.source === "ai" ? "badge-indigo" : ""}`}>{result.source === "ai" ? "AI ranked" : "Rule-based"}</span>
              {result.note && <span>{result.note}</span>}
            </p>
            {result.suggestions.length === 0 ? (
              <p className="field-hint">No one to suggest.</p>
            ) : (
              <ul className="smart-list">
                {result.suggestions.map((s, i) => {
                  const p = people.find((x) => x.id === s.userId);
                  if (!p) return null;
                  const chosen = value === s.userId;
                  return (
                    <li key={s.userId} className="smart-card">
                      <Avatar id={p.id} name={p.name} src={p.avatar} size="sm" />
                      <div className="smart-card-main">
                        <b>{i + 1}. {displayName(p.name)} <span className="smart-score" title="Rule score out of 100">{s.score}</span></b>
                        <ul className="smart-reasons">{s.reasons.slice(0, 3).map((r, j) => <li key={j}>{r}</li>)}</ul>
                      </div>
                      <button type="button" className="btn smart-pick" aria-pressed={chosen} aria-label={chosen ? `${displayName(p.name)} is assigned` : `Assign ${displayName(p.name)}`} onClick={() => onPick(s.userId)} disabled={chosen}>
                        {chosen ? <><CheckIcon size={14} /> Chosen</> : "Assign"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
