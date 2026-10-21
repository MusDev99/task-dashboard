"use client";

import { useState } from "react";
import { doneStatus } from "../../lib/task-status";
import type { TaskConfig } from "../../lib/task-config";
import { SortIcon } from "../components/ui/Icons";
import TaskMenu, { type TaskActions } from "./TaskMenu";
import { AssigneeChip, LabelChips, LinkChips, PointsChip, dateRange } from "./TaskBits";
import type { Person, WorkTask } from "./types";

export type TaskSortKey = "code" | "title" | "status" | "points" | "due";
export interface TaskSort { key: TaskSortKey; dir: "asc" | "desc" }

interface Props {
  tasks: WorkTask[];
  subtasksOf: Map<string, WorkTask[]>;
  people: Map<string, Person>;
  config: TaskConfig;
  today: string;
  sort: TaskSort;
  onSort: (k: TaskSortKey) => void;
  actions: TaskActions;
}

const COLS: { key: TaskSortKey | null; label: string; className?: string }[] = [
  { key: "code", label: "Code" },
  { key: "title", label: "Task" },
  { key: "status", label: "Status" },
  { key: null, label: "Assignee" },
  { key: "points", label: "Points" },
  { key: "due", label: "Dates" },
];

export default function ListTreeView({ tasks, subtasksOf, people, config, today, sort, onSort, actions }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded((e) => { const n = new Set(e); if (!n.delete(id)) n.add(id); return n; });
  const doneKey = doneStatus(config);
  const isOpen = (status: string) => config.statuses.find((s) => s.key === status)?.open ?? true;

  const row = (t: WorkTask, level: 0 | 1) => {
    const subs = subtasksOf.get(t.id) ?? [];
    const overdue = t.dueDate && t.dueDate < today && isOpen(t.status);
    return (
      <tr key={t.id} className={level ? "is-subrow" : undefined}>
        <td className="task-code-cell">
          {level === 0 && subs.length > 0 ? (
            <button type="button" className="tree-toggle" aria-expanded={expanded.has(t.id)} aria-label={`${expanded.has(t.id) ? "Collapse" : "Expand"} subtasks of ${t.code}`} onClick={() => toggle(t.id)}>
              {expanded.has(t.id) ? "▾" : "▸"}
            </button>
          ) : (
            <span className="tree-spacer" aria-hidden="true">{level ? "↳" : ""}</span>
          )}
          <span className="code-tag">{t.code}</span>
        </td>
        <td className="task-title-cell">
          <button type="button" className="task-title-btn" onClick={() => actions.onOpen(t.id)}>{t.title}</button>
          <div className="task-meta-line">
            <LabelChips labels={t.labels} />
            <LinkChips links={t.links} />
            {subs.length > 0 && <span className="sub-progress">{subs.filter((s) => s.status === doneKey).length}/{subs.length} subtasks</span>}
          </div>
        </td>
        <td>
          <label className="sr-only" htmlFor={`st-${t.id}`}>Status of {t.code}</label>
          <select id={`st-${t.id}`} className="select select-sm" value={t.status} style={{ borderColor: config.statuses.find((s) => s.key === t.status)?.color }} onChange={(e) => actions.onStatus(t, e.target.value)}>
            {config.statuses.filter((s) => s.active || s.key === t.status).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </td>
        <td><AssigneeChip person={t.assigneeId ? people.get(t.assigneeId) : undefined} /></td>
        <td><PointsChip points={t.storyPoints} config={config} /></td>
        <td className={`task-dates ${overdue ? "is-overdue" : ""}`}>{dateRange(t.startDate, t.dueDate, today) ?? <span className="muted">No dates</span>}{overdue && <span className="overdue-tag">Overdue</span>}</td>
        <td><TaskMenu task={t} config={config} actions={actions} /></td>
      </tr>
    );
  };

  return (
    <div className="table-scroll">
      <table className="data-table task-table">
        <thead>
          <tr>
            {COLS.map((c) => (
              <th key={c.label} scope="col" aria-sort={c.key && sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
                {c.key ? <button type="button" onClick={() => onSort(c.key!)}>{c.label} <SortIcon size={12} /></button> : c.label}
              </th>
            ))}
            <th scope="col" style={{ width: 52 }}><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {tasks.flatMap((t) => [row(t, 0), ...(expanded.has(t.id) ? (subtasksOf.get(t.id) ?? []).map((s) => row(s, 1)) : [])])}
        </tbody>
      </table>
    </div>
  );
}
