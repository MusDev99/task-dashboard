import { UsersIcon, CheckIcon, PauseIcon, SparkIcon } from "../components/ui/Icons";
import type { UserRow } from "./types";
import StatCard from "../components/ui/StatCard";

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
      <StatCard label="Total users" value={users.length} hint="All registered people" color="var(--accent-indigo)" icon={<UsersIcon size={20} />} />
      <StatCard label="Active" value={active} hint={`${pct}% of all users`} color="var(--accent-emerald)" icon={<CheckIcon size={20} />} />
      <StatCard label="Inactive" value={users.length - active} hint="Deactivated accounts" color="var(--accent-amber)" icon={<PauseIcon size={20} />} />
      <StatCard label="New this month" value={users.filter((u) => isThisMonth(u.joinedDate)).length} hint="Joined in the current month" color="var(--accent-pink)" icon={<SparkIcon size={20} />} />
    </div>
  );
}
