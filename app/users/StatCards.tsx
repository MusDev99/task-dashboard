import type { ReactNode } from "react";
import { UsersIcon, CheckIcon, PauseIcon, SparkIcon } from "../components/ui/Icons";
import type { UserRow } from "./types";

function Card({ label, value, hint, color, icon }: { label: string; value: number; hint: string; color: string; icon: ReactNode }) {
  return (
    <div className="stat-card stat-card-compact" style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>{label}</div>
          <div style={{ fontSize: "1.9rem", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{value}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>{hint}</div>
        </div>
        <div className="stat-icon" style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: `color-mix(in srgb, ${color} 14%, transparent)`, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/** Joined dates look like "2026-01-21 06:55:00.915" (UTC). */
function isThisMonth(joined: string) {
  const d = new Date(joined.replace(" ", "T") + (joined.includes("Z") ? "" : "Z"));
  const now = new Date();
  return !Number.isNaN(d.getTime()) && d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

export default function StatCards({ users }: { users: UserRow[] }) {
  const active = users.filter((u) => u.isActive).length;
  const pct = users.length ? Math.round((active / users.length) * 100) : 0;
  return (
    <div className="stats-grid stats-compact" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
      <Card label="Total users" value={users.length} hint="All registered people" color="var(--accent-indigo)" icon={<UsersIcon size={20} />} />
      <Card label="Active" value={active} hint={`${pct}% of all users`} color="var(--accent-emerald)" icon={<CheckIcon size={20} />} />
      <Card label="Inactive" value={users.length - active} hint="Deactivated accounts" color="var(--accent-amber)" icon={<PauseIcon size={20} />} />
      <Card label="New this month" value={users.filter((u) => isThisMonth(u.joinedDate)).length} hint="Joined in the current month" color="var(--accent-pink)" icon={<SparkIcon size={20} />} />
    </div>
  );
}
