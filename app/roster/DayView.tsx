"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import Avatar from "../components/ui/Avatar";
import CodeChip from "./CodeChip";
import { ChevronLeft, ChevronRight } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import { dayLabel } from "../../lib/roster-dates";
import type { MonthDay } from "./days";
import type { ShiftCode } from "../../lib/shifts";
import type { Resource } from "./types";

interface Props {
  resources: Resource[];
  days: MonthDay[];
  day: number;
  codes: Map<string, ShiftCode>;
  values: Map<string, string>; // `${userId}|${date}` -> code
  onDay: (day: number) => void;
  onEdit: (userId: string, el: HTMLElement) => void;
  onAssignAll: (el: HTMLElement) => void;
}

const DayRow = memo(function DayRow({ r, code, def, onEdit }: { r: Resource; code: string; def?: ShiftCode; onEdit: Props["onEdit"] }) {
  const name = displayName(r.name);
  return (
    <li>
      <button type="button" className="day-row" onClick={(e) => onEdit(r.id, e.currentTarget)} aria-label={`${name}: ${code ? def?.label ?? code : "no entry"}. Change`}>
        <Avatar id={r.id} name={r.name} src={r.avatar} size="sm" />
        <span className="day-row-text">
          <b>{name}</b>
          <small>{def?.start ? `${def.label} · ${def.start}–${def.end}` : def?.label ?? (code || "Not scheduled")}</small>
        </span>
        <span className="day-row-chip">{code ? <CodeChip def={def} code={code} /> : <span className="day-row-empty">Set</span>}</span>
      </button>
    </li>
  );
});

/**
 * Mobile-first roster: one day at a time. A swipeable day strip on top (thumb-reachable), every
 * shown person as a full-width 56px row below; tap a row to open the bottom-sheet picker.
 */
export default function DayView({ resources, days, day, codes, values, onDay, onEdit, onAssignAll }: Props) {
  const strip = useRef<HTMLDivElement>(null);
  const current = days[day - 1] ?? days[0];

  // Keep the selected day visible in the strip.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(`[data-day="${day}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [day]);

  // How many people are on each code today (shown above the list, in roster-code order).
  const summary = useMemo(() => {
    const count = new Map<string, number>();
    let none = 0;
    for (const r of resources) {
      const c = values.get(`${r.id}|${current.date}`);
      if (c) count.set(c, (count.get(c) ?? 0) + 1);
      else none++;
    }
    const order = [...codes.keys()];
    return { items: [...count].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])), none };
  }, [resources, values, codes, current.date]);

  // Horizontal swipe on the list changes the day.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x;
    const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onDay(Math.max(1, Math.min(days.length, day + (dx < 0 ? 1 : -1))));
  };

  return (
    <div className="day-view">
      <div className="day-strip" ref={strip} role="tablist" aria-label="Day of month">
        {days.map(({ d, mid, longLabel, weekend, isToday }) => (
          <button
            key={d}
            type="button"
            role="tab"
            data-day={d}
            aria-selected={d === day}
            aria-label={longLabel}
            tabIndex={d === day ? 0 : -1}
            className={`day-chip${d === day ? " is-active" : ""}${isToday ? " is-today" : ""}${weekend ? " is-weekend" : ""}`}
            onClick={() => onDay(d)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const next = Math.max(1, Math.min(days.length, day + (e.key === "ArrowRight" ? 1 : -1)));
                onDay(next);
                strip.current?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus();
              }
            }}
          >
            <span>{mid}</span>
            <b>{d}</b>
          </button>
        ))}
      </div>

      <div className="day-head">
        <button type="button" className="icon-btn" aria-label="Previous day" disabled={day <= 1} onClick={() => onDay(day - 1)}><ChevronLeft size={18} /></button>
        <div className="day-head-title">
          <b>{dayLabel(current.date)}</b>
          <span className="day-summary" aria-live="polite">
            {summary.items.map(([c, n]) => <span key={c} className="day-summary-item"><CodeChip def={codes.get(c)} code={c} /> {n}</span>)}
            {summary.none > 0 && <span className="day-summary-item day-summary-none">{summary.none} not scheduled</span>}
          </span>
        </div>
        <button type="button" className="icon-btn" aria-label="Next day" disabled={day >= days.length} onClick={() => onDay(day + 1)}><ChevronRight size={18} /></button>
      </div>

      <ul className="day-list" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {resources.map((r) => {
          const code = values.get(`${r.id}|${current.date}`) ?? "";
          return <DayRow key={r.id} r={r} code={code} def={codes.get(code)} onEdit={onEdit} />;
        })}
      </ul>

      <button type="button" className="btn day-assign-all" onClick={(e) => onAssignAll(e.currentTarget)}>
        Set {current.d} {current.mid} for all {resources.length} shown
      </button>
    </div>
  );
}
