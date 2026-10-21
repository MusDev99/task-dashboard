"use client";

import Link from "next/link";
import Avatar from "../components/ui/Avatar";
import RowMenu from "./RowMenu";
import { SortIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import type { UserRow } from "./types";

export type SortKey = "name" | "location" | "tasks" | "score" | "joined";
export interface Sort { key: SortKey; dir: "asc" | "desc" }

const COLUMNS: { key: SortKey | null; label: string; num?: boolean }[] = [
  { key: "name", label: "User" },
  { key: "location", label: "Location" },
  { key: null, label: "Status" },
  { key: "tasks", label: "Tasks", num: true },
  { key: "score", label: "Score", num: true },
  { key: "joined", label: "Joined" },
];

const fmtDate = (s: string) => {
  const d = new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

interface Props {
  users: UserRow[];
  sort: Sort;
  onSort: (key: SortKey) => void;
  onEdit: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
}

export default function UserTable({ users, sort, onSort, onEdit, onDelete }: Props) {
  return (
    <div className="table-scroll table-only">
      <table className="data-table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.label} scope="col" className={c.num ? "num" : undefined} aria-sort={c.key && sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                {c.key ? (
                  <button type="button" onClick={() => onSort(c.key!)}>
                    {c.label} <SortIcon size={12} />
                  </button>
                ) : c.label}
              </th>
            ))}
            <th scope="col" style={{ width: 56 }}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={{ maxWidth: 320 }}>
                <div className="cell-user">
                  <Avatar id={u.id} name={u.name} src={u.avatar} />
                  <div>
                    <Link className="name" href={`/users/${u.id}`} style={{ display: "block" }}>{displayName(u.name)}</Link>
                    <div className="sub">{u.email}</div>
                  </div>
                </div>
              </td>
              <td>{u.locationName ? <span className="badge badge-indigo">{u.locationName}</span> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
              <td><span className={`status ${u.isActive ? "status-active" : "status-inactive"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
              <td className="num">{u.tasksCompleted}</td>
              <td className="num" style={{ color: "var(--accent-amber)", fontWeight: 600 }}>{u.meritScore}</td>
              <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{fmtDate(u.joinedDate)}</td>
              <td><RowMenu user={u} onEdit={() => onEdit(u)} onDelete={() => onDelete(u)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
