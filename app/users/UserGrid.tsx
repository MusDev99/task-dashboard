"use client";

import Link from "next/link";
import Avatar from "../components/ui/Avatar";
import RowMenu from "./RowMenu";
import { displayName } from "../lib/ui";
import type { UserRow } from "./types";

interface Props {
  users: UserRow[];
  mobileOnly?: boolean;
  onEdit: (u: UserRow) => void;
  onDelete: (u: UserRow) => void;
}

export default function UserGrid({ users, mobileOnly, onEdit, onDelete }: Props) {
  return (
    <div className={`user-grid ${mobileOnly ? "grid-mobile-only" : ""}`} style={{ padding: mobileOnly ? "1rem" : 0 }}>
      {users.map((u) => (
        <div key={u.id} className="glass-card user-card">
          <RowMenu user={u} onEdit={() => onEdit(u)} onDelete={() => onDelete(u)} />
          <Link href={`/users/${u.id}`} style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: "inherit", paddingRight: 40, minWidth: 0 }}>
            <Avatar id={u.id} name={u.name} src={u.avatar} size="lg" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName(u.name)}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 6 }}>{u.email}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {u.locationName && <span className="badge badge-indigo">{u.locationName}</span>}
                <span className={`status ${u.isActive ? "status-active" : "status-inactive"}`}>{u.isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </Link>
          <div className="user-card-stats">
            <div><b style={{ color: "var(--accent-amber)" }}>{u.meritScore}</b><span>Score</span></div>
            <div><b>{u.tasksCompleted}</b><span>Tasks</span></div>
            <div><b style={{ color: "var(--accent-emerald)" }}>{u.avgCorrectness}%</b><span>Accuracy</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}
