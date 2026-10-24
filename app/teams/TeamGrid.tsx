"use client";

import { useState } from "react";
import Avatar from "../components/ui/Avatar";
import { CrownIcon, EditIcon, TrashIcon, UsersIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import { teamColor } from "./TeamBits";
import type { TeamPerson, TeamRow } from "./types";

const PREVIEW = 3; // members shown before "Show all" (Miller: small chunks)

interface Props {
  teams: TeamRow[];
  people: Map<string, TeamPerson>;
  mobileOnly?: boolean;
  onEdit: (t: TeamRow) => void;
  onDelete: (t: TeamRow) => void;
}

function Person({ p, lead }: { p: TeamPerson; lead?: boolean }) {
  return (
    <li className={`team-person ${lead ? "is-lead" : ""}`}>
      <Avatar id={p.id} name={p.name} src={p.avatar} size={lead ? "md" : "sm"} />
      <span className="team-person-main">
        <b>{displayName(p.name)}{p.isActive ? "" : " (inactive)"}</b>
        {p.employeeId && <small>{p.employeeId}</small>}
      </span>
    </li>
  );
}

function TeamCard({ team, people, onEdit, onDelete }: { team: TeamRow; people: Map<string, TeamPerson>; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const lead = team.leadId ? people.get(team.leadId) : undefined;
  const members = team.memberIds
    .filter((id) => id !== team.leadId)
    .map((id) => people.get(id))
    .filter((p): p is TeamPerson => !!p)
    .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  const total = members.length + (lead ? 1 : 0);
  const shown = expanded ? members : members.slice(0, PREVIEW);
  const listId = `team-members-${team.id}`;

  return (
    <article className="team-card" style={teamColor(team.color)} aria-labelledby={`team-name-${team.id}`}>
      <header className="team-card-head">
        <span className="team-card-icon" aria-hidden="true"><UsersIcon size={22} /></span>
        <div className="team-card-title">
          <h3 id={`team-name-${team.id}`}>{team.name}</h3>
          {team.description && <p>{team.description}</p>}
          <span className="team-card-count"><span className="team-dot" aria-hidden="true" />{total} member{total === 1 ? "" : "s"}</span>
        </div>
        <div className="team-card-actions">
          <button type="button" className="icon-btn" aria-label={`Edit ${team.name}`} title="Edit" onClick={onEdit}><EditIcon size={17} /></button>
          <button type="button" className="icon-btn icon-btn-danger" aria-label={`Delete ${team.name}`} title="Delete" onClick={onDelete}><TrashIcon size={17} /></button>
        </div>
      </header>

      <section className="team-card-section team-card-lead" aria-label="Team lead">
        <h4><CrownIcon size={15} /> Team lead</h4>
        {lead ? <ul className="team-people"><Person p={lead} lead /></ul> : <p className="team-card-empty">No lead assigned</p>}
      </section>

      <section className="team-card-section" aria-label="Members">
        <div className="team-card-section-head">
          <h4>Members ({members.length})</h4>
          {members.length > PREVIEW && (
            <button type="button" className="link-btn" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((e) => !e)}>
              {expanded ? "Show less" : `Show all (${members.length})`}
            </button>
          )}
        </div>
        {members.length ? (
          <ul id={listId} className="team-people">{shown.map((p) => <Person key={p.id} p={p} />)}</ul>
        ) : (
          <p className="team-card-empty">{lead ? "Only the lead so far" : "No members"}</p>
        )}
      </section>
    </article>
  );
}

export default function TeamGrid({ teams, people, mobileOnly, onEdit, onDelete }: Props) {
  return (
    <div className={`team-grid ${mobileOnly ? "grid-mobile-only" : ""}`}>
      {teams.map((t) => <TeamCard key={t.id} team={t} people={people} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />)}
    </div>
  );
}
