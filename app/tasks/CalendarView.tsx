"use client";

import { useMemo, useState } from "react";
import type { TaskConfig } from "../../lib/task-config";
import { dateOf, dayLabel, daysInMonth, monthLabel, shiftMonth, weekday } from "../../lib/roster-dates";
import { ChevronLeft, ChevronRight } from "../components/ui/Icons";
import { AssigneeChip } from "./TaskBits";
import type { Person, WorkTask } from "./types";

interface Props {
  tasks: WorkTask[]; // filtered tasks + their subtasks
  people: Map<string, Person>;
  config: TaskConfig;
  month: string;
  today: string;
  onMonth: (m: string) => void;
  onOpen: (id: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PER_DAY = 3;

export default function CalendarView({ tasks, people, config, month, today, onMonth, onOpen }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const days = daysInMonth(month);
  const first = dateOf(month, 1);
  const start = config.weekStart; // 0 = Sunday, 1 = Monday (Settings → General)
  const week = [...DAYS.slice(start), ...DAYS.slice(0, start)];
  const lead = (weekday(first) - start + 7) % 7;
  const colorOf = (status: string) => config.statuses.find((s) => s.key === status)?.color ?? "var(--text-muted)";

  // A task shows on every day from start to due (or on its single date).
  const onDay = (date: string) =>
    tasks.filter((t) => {
      const s = t.startDate ?? t.dueDate;
      const e = t.dueDate ?? t.startDate;
      return s && e && date >= (s < e ? s : e) && date <= (s < e ? e : s);
    });
  const undated = tasks.filter((t) => !t.startDate && !t.dueDate);

  // Phones get an agenda (only days with tasks, from today on in the current month) instead of a 7-column grid.
  const allAgenda = useMemo(
    () => Array.from({ length: days }, (_, i) => dateOf(month, i + 1)).map((d) => ({ date: d, list: onDay(d) })).filter((d) => d.list.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, month, days]
  );
  const pastDays = month === today.slice(0, 7) ? allAgenda.filter((d) => d.date < today).length : 0;
  const agenda = showPast ? allAgenda : allAgenda.slice(pastDays);

  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => dateOf(month, i + 1))];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="cal-wrap">
      <div className="cal-head">
        <div className="wb-nav" role="group" aria-label="Change month">
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => onMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button>
          <button type="button" className="wb-today" disabled={month === today.slice(0, 7)} onClick={() => onMonth(today.slice(0, 7))}>Today</button>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => onMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button>
        </div>
        <h3>{monthLabel(month)}</h3>
      </div>
      <div className="cal-agenda" aria-label={`Agenda for ${monthLabel(month)}`}>
        {pastDays > 0 && (
          <button type="button" className="btn" onClick={() => setShowPast((v) => !v)} aria-expanded={showPast}>
            {showPast ? "Hide earlier days" : `Show earlier days (${pastDays})`}
          </button>
        )}
        {agenda.length === 0 ? (
          <p className="field-hint">No dated tasks {month === today.slice(0, 7) ? "from today until the end of the month" : "this month"}.</p>
        ) : (
          agenda.map(({ date, list }) => (
            <section key={date} className={`cal-agenda-day ${date === today ? "is-today" : ""}`}>
              <h4>{date === today ? "Today · " : ""}{dayLabel(date)} <span>{list.length}</span></h4>
              <ul>
                {list.map((t) => (
                  <li key={t.id}>
                    <button type="button" className="cal-agenda-task" style={{ borderLeftColor: colorOf(t.status) }} onClick={() => onOpen(t.id)}>
                      <span className="code-tag">{t.code}</span>
                      <span className="cal-agenda-title">{t.parentId && <span aria-label="subtask">↳ </span>}{t.title}</span>
                    </button>
                    <AssigneeChip person={t.assigneeId ? people.get(t.assigneeId) : undefined} compact />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <div className="table-scroll cal-grid-wrap">
        <div className="cal-grid" role="grid" aria-label={`Tasks in ${monthLabel(month)}`}>
          {week.map((w) => <div key={w} className="cal-weekday" role="columnheader">{w}</div>)}
          {cells.map((date, i) => {
            if (!date) return <div key={`x${i}`} className="cal-cell is-blank" aria-hidden="true" />;
            const list = onDay(date);
            const open = expanded === date;
            const shown = open ? list : list.slice(0, MAX_PER_DAY);
            return (
              <div key={date} role="gridcell" className={`cal-cell ${date === today ? "is-today" : ""}`} aria-label={`${date}, ${list.length} tasks`}>
                <div className="cal-date">{Number(date.slice(8))}</div>
                {shown.map((t) => (
                  <button key={t.id} type="button" className="cal-task" style={{ borderLeftColor: colorOf(t.status) }} onClick={() => onOpen(t.id)} title={`${t.code} · ${t.title}`}>
                    {t.parentId && <span aria-label="subtask">↳ </span>}{t.title}
                  </button>
                ))}
                {list.length > MAX_PER_DAY && (
                  <button type="button" className="cal-more" onClick={() => setExpanded(open ? null : date)}>{open ? "Show less" : `+${list.length - MAX_PER_DAY} more`}</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="cal-undated">
        <h4>No dates ({undated.length})</h4>
        {undated.length === 0 ? (
          <p className="field-hint">Every task has a date.</p>
        ) : (
          <ul>
            {undated.map((t) => (
              <li key={t.id}>
                <button type="button" className="cal-task" style={{ borderLeftColor: colorOf(t.status) }} onClick={() => onOpen(t.id)}>
                  <span className="code-tag">{t.code}</span> {t.title}
                </button>
                <AssigneeChip person={t.assigneeId ? people.get(t.assigneeId) : undefined} compact />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
