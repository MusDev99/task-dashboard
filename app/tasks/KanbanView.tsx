"use client";

import { useState } from "react";
import { doneStatus } from "../../lib/task-status";
import type { TaskConfig } from "../../lib/task-config";
import { ClockIcon } from "../components/ui/Icons";
import TaskMenu, { type TaskActions } from "./TaskMenu";
import { AssigneeChip, LabelChips, LinkChips, PointsChip, dateRange } from "./TaskBits";
import type { Person, WorkTask } from "./types";

interface Props {
  tasks: WorkTask[];
  subtasksOf: Map<string, WorkTask[]>;
  people: Map<string, Person>;
  config: TaskConfig;
  today: string;
  actions: TaskActions;
}

export default function KanbanView({ tasks, subtasksOf, people, config, today, actions }: Props) {
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const doneKey = doneStatus(config);

  const drop = (status: string, e: React.DragEvent) => {
    e.preventDefault();
    setOver(null);
    const id = e.dataTransfer.getData("text/task-id");
    const task = tasks.find((t) => t.id === id);
    if (task && task.status !== status) actions.onStatus(task, status);
  };

  return (
    <div className="kanban" role="list" aria-label="Task board">
      {config.statuses.filter((s) => s.active || tasks.some((t) => t.status === s.key)).map((s) => {
        const lane = tasks.filter((t) => t.status === s.key);
        return (
          <section
            key={s.key}
            role="listitem"
            aria-label={`${s.label}, ${lane.length} tasks`}
            className={`kanban-lane ${over === s.key ? "is-over" : ""}`}
            onDragOver={(e) => { if (dragging) { e.preventDefault(); setOver(s.key); } }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
            onDrop={(e) => drop(s.key, e)}
          >
            <header className="kanban-lane-head">
              <h3><span className="dot" style={{ background: s.color }} />{s.label.toUpperCase()}</h3>
              <span className="kanban-count">{lane.length}</span>
            </header>
            <div className="kanban-cards">
              {lane.length === 0 && <div className="kanban-empty">{dragging ? "Drop here" : "Empty lane"}</div>}
              {lane.map((t) => {
                const subs = subtasksOf.get(t.id) ?? [];
                const range = dateRange(t.startDate, t.dueDate, today);
                const open = config.statuses.find((x) => x.key === t.status)?.open ?? true;
                const overdue = t.dueDate && t.dueDate < today && open;
                return (
                  <article
                    key={t.id}
                    className={`kanban-card ${dragging === t.id ? "is-dragging" : ""}`}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/task-id", t.id); e.dataTransfer.effectAllowed = "move"; setDragging(t.id); }}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                  >
                    <div className="kanban-card-top">
                      <span className="code-tag">{t.code}</span>
                      <TaskMenu task={t} config={config} actions={actions} />
                    </div>
                    <button type="button" className="kanban-title" onClick={() => actions.onOpen(t.id)}>{t.title}</button>
                    {t.description && <p className="kanban-desc">{t.description}</p>}
                    <LabelChips labels={t.labels} />
                    <div className="kanban-meta">
                      <span className={`kanban-dates ${overdue ? "is-overdue" : ""}`}><ClockIcon size={13} /> {range ?? <i>No dates</i>}</span>
                      <PointsChip points={t.storyPoints} config={config} />
                    </div>
                    <LinkChips links={t.links} />
                    {subs.length > 0 && (
                      <div className="kanban-subs">
                        <div className="kanban-subs-head">Subtasks <span>{subs.filter((x) => x.status === doneKey).length}/{subs.length}</span></div>
                        <ul>
                          {subs.map((x) => (
                            <li key={x.id}>
                              <button type="button" className={`check ${x.status === doneKey ? "is-done" : ""}`} aria-pressed={x.status === doneKey} aria-label={`Mark ${x.code} ${x.status === doneKey ? "not done" : "done"}`} onClick={() => actions.onToggleDone(x)} />
                              <button type="button" className="kanban-sub-title" onClick={() => actions.onOpen(x.id)}>
                                <span className={x.status === doneKey ? "is-struck" : ""}>{x.title}</span>
                              </button>
                              <AssigneeChip person={x.assigneeId ? people.get(x.assigneeId) : undefined} compact />
                              <span className="code-tag">{x.code}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="kanban-foot">
                      <AssigneeChip person={t.assigneeId ? people.get(t.assigneeId) : undefined} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
