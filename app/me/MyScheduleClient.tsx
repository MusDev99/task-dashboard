"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setTaskStatus } from "../../lib/task-actions";
import type { ScheduleDay, ScheduleSummary, MyTask } from "../../lib/my-schedule";
import type { TaskConfig } from "../../lib/task-config";
import CodeChip from "../roster/CodeChip";
import { fmtDay } from "../tasks/TaskBits";
import ToastRegion from "../components/ui/Toast";
import { useToasts } from "../components/ui/useToasts";
import { AlertIcon } from "../components/ui/Icons";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  days: ScheduleDay[];
  summary: ScheduleSummary;
  tasks: MyTask[];
  config: TaskConfig;
  today: string;
  signedIn: boolean;
  loadError: boolean;
}

/** "Morning · 06:00–14:00", the leave label, or "Not scheduled". */
function describe(d: ScheduleDay): string {
  if (!d.code) return "Not scheduled";
  if (!d.def) return d.code;
  return d.def.start && d.def.end ? `${d.def.label} · ${d.def.start}–${d.def.end}` : d.def.label;
}

function todayLine(d: ScheduleDay): string {
  if (!d.code) return "You're not scheduled today.";
  if (d.def?.type === "leave") return `You're on ${d.def.label} today.`;
  if (d.def && d.def.hours === 0) return `${d.def.label} today.`;
  return `You're on ${describe(d)}.`;
}

export default function MyScheduleClient({ days, summary, tasks, config, today, signedIn, loadError }: Props) {
  const { toasts, notify } = useToasts();
  const [, startTransition] = useTransition();
  const [items, setStatus] = useOptimistic(tasks, (state: MyTask[], c: { id: string; status: string }) =>
    state.map((m) => (m.task.id === c.id ? { ...m, task: { ...m.task, status: c.status } } : m)));
  const statuses = config.statuses;
  const todayDay = days[0];

  const change = (m: MyTask, status: string) => {
    startTransition(async () => {
      setStatus({ id: m.task.id, status });
      const res = await setTaskStatus(m.task.id, status);
      const label = statuses.find((s) => s.key === status)?.label ?? status;
      if (res.ok) notify("success", `${m.task.code} moved to ${label}`);
      else notify("error", res.message ?? "Couldn't update the status. It was reverted.");
    });
  };

  return (
    <div className="page my-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My schedule</h1>
          <p className="page-subtitle">Your shifts, leave and open tasks for the next two weeks.</p>
        </div>
      </div>

      {loadError && <div className="alert alert-danger" role="alert"><AlertIcon /> Couldn&apos;t load everything. Please refresh. If it keeps happening, contact an administrator.</div>}
      {!signedIn && <div className="alert alert-info" role="status">My schedule needs a signed-in user. Sign in with your account to see your own shifts and tasks.</div>}

      {todayDay && (
        <section className="my-today" aria-labelledby="my-today-title">
          <h2 id="my-today-title">Today · {WEEKDAYS[todayDay.weekday]} {fmtDay(todayDay.date)}</h2>
          <p className="my-today-line">
            {todayDay.code && <CodeChip def={todayDay.def ?? undefined} code={todayDay.code} />}
            <span>{todayLine(todayDay)}</span>
          </p>
          <p className="my-summary">
            Next 14 days: <b>{summary.workingDays}</b> working day{summary.workingDays === 1 ? "" : "s"} · <b>{summary.hours}</b>h
            {summary.leaveDays > 0 && <> · <b>{summary.leaveDays}</b> on leave</>}
            {summary.unscheduledDays > 0 && <> · <b>{summary.unscheduledDays}</b> not scheduled</>}
          </p>
        </section>
      )}

      <div className="my-columns">
        <section className="table-card my-days" aria-labelledby="my-days-title">
          <h2 id="my-days-title" className="my-section-title">Next 14 days</h2>
          {summary.unscheduledDays === days.length ? (
            <div className="empty-state"><h3>No shifts planned yet</h3><p>Your planner hasn&apos;t scheduled you for the next 2 weeks.</p></div>
          ) : (
            <ol className="my-day-list">
              {days.map((d) => (
                <li key={d.date} className={`my-day${d.isToday ? " is-today" : ""}${d.weekend ? " is-weekend" : ""}${d.weekBreak ? " week-break" : ""}`}>
                  {d.weekBreak && <span className="my-week">Week of {fmtDay(d.date)}</span>}
                  <span className="my-day-date"><b>{WEEKDAYS[d.weekday]}</b> {fmtDay(d.date)}{d.isToday && <span className="sr-only"> (today)</span>}</span>
                  <span className="my-day-what">{describe(d)}</span>
                  <span className="my-day-chip">{d.code ? <CodeChip def={d.def ?? undefined} code={d.code} /> : null}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="table-card my-tasks" aria-labelledby="my-tasks-title">
          <h2 id="my-tasks-title" className="my-section-title">My tasks <span className="seg-count">{items.length}</span></h2>
          {items.length === 0 ? (
            <div className="empty-state"><h3>Nothing assigned to you</h3><p>Open tasks assigned to you show up here.</p></div>
          ) : (
            <ul className="my-task-list">
              {items.map((m) => (
                <li key={m.task.id} className="my-task">
                  <div className="my-task-main">
                    <Link href={`/tasks?view=list&q=${encodeURIComponent(m.task.code)}`} className="my-task-title">
                      <span className="code-tag">{m.task.code}</span> {m.task.title}
                    </Link>
                    <small>
                      {m.parentTitle && <>Subtask of {m.parentTitle} · </>}
                      {m.task.dueDate ? <span className={m.overdue ? "is-overdue" : undefined}>{m.overdue ? "Overdue · due " : "Due "}{fmtDay(m.task.dueDate, today)}</span> : "No due date"}
                    </small>
                  </div>
                  <label className="sr-only" htmlFor={`my-st-${m.task.id}`}>Status of {m.task.code}</label>
                  <select id={`my-st-${m.task.id}`} className="select select-sm" value={m.task.status} onChange={(e) => change(m, e.target.value)}>
                    {statuses.filter((s) => s.active || s.key === m.task.status).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ToastRegion toasts={toasts} />
    </div>
  );
}
