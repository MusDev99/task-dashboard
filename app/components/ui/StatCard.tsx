import type { ReactNode } from "react";

/** Admin stat card (label, value, hint, tinted icon). On phones a `.stats-compact` row turns into a swipeable strip. */
export default function StatCard({ label, value, hint, color, icon }: { label: string; value: number | string; hint: string; color: string; icon: ReactNode }) {
  return (
    <div className="stat-card stat-card-compact">
      <div className="stat-card-body">
        <div style={{ minWidth: 0 }}>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          <div className="stat-hint">{hint}</div>
        </div>
        <div className="stat-icon" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{icon}</div>
      </div>
    </div>
  );
}
