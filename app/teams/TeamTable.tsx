"use client";

import Avatar from "../components/ui/Avatar";
import { SortIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import { AvatarStack, TeamChip, TeamMenu } from "./TeamBits";
import type { TeamPerson, TeamRow } from "./types";

export type SortKey = "name" | "members" | "lead" | "updated";
export interface Sort { key: SortKey; dir: "asc" | "desc" }

const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: "name", label: "Team" },
  { key: "members", label: "Members" },
  { key: "lead", label: "Lead" },
  { key: "updated", label: "Updated" },
];

export const fmtDate = (s: string) => {
  const d = new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

interface Props {
  teams: TeamRow[];
  people: Map<string, TeamPerson>;
  sort: Sort;
  onSort: (key: SortKey) => void;
  onEdit: (t: TeamRow) => void;
  onDelete: (t: TeamRow) => void;
}

export default function TeamTable({ teams, people, sort, onSort, onEdit, onDelete }: Props) {
  return (
    <div className="table-scroll table-only">
      <table className="data-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                <button type="button" onClick={() => onSort(c.key)}>{c.label} <SortIcon size={12} /></button>
              </th>
            ))}
            <th scope="col" style={{ width: 56 }}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => {
            const members = t.memberIds.map((id) => people.get(id)).filter((p): p is TeamPerson => !!p);
            const lead = t.leadId ? people.get(t.leadId) : undefined;
            return (
              <tr key={t.id}>
                <td style={{ maxWidth: 360 }}>
                  <TeamChip name={t.name} color={t.color} />
                  {t.description && <div className="team-desc">{t.description}</div>}
                </td>
                <td>
                  <span className="team-members-cell">
                    <AvatarStack people={members} />
                    <span className="member-count" aria-hidden="true">{members.length}</span>
                  </span>
                </td>
                <td>
                  {lead ? (
                    <span className="cell-user">
                      <Avatar id={lead.id} name={lead.name} src={lead.avatar} size="sm" />
                      <span className="name">{displayName(lead.name)}</span>
                    </span>
                  ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </td>
                <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{fmtDate(t.updatedAt)}</td>
                <td><TeamMenu team={t} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
