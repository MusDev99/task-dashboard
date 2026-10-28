"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createTask, getAssigneeAvailability, updateTask } from "../../lib/task-actions";
import { cleanTaskInput, validateTask, type TaskErrors, type TaskField } from "../../lib/task-validation";
import { defaultStatus, doneStatus } from "../../lib/task-status";
import type { TaskConfig } from "../../lib/task-config";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { CloseIcon, PlusIcon, TrashIcon, AlertIcon } from "../components/ui/Icons";
import { useFocusTrap } from "../components/ui/useFocusTrap";
import AssigneePicker from "./AssigneePicker";
import SmartAssign from "./SmartAssign";
import LabelsInput from "./LabelsInput";
import LinksEditor from "./LinksEditor";
import { AssigneeChip, PointsChip, StatusPill } from "./TaskBits";
import type { Availability, Person, TaskInput, WorkTask } from "./types";
import type { TeamOption } from "../teams/types";

export type DrawerTarget = { mode: "create"; parentId: string | null } | { mode: "edit"; id: string };

interface Props {
  target: DrawerTarget;
  tasks: WorkTask[];
  people: Person[];
  teams: TeamOption[];
  config: TaskConfig;
  onClose: () => void;
  onSaved: (message: string, task: WorkTask) => void;
  onNavigate: (target: DrawerTarget) => void;
  onDelete: (task: WorkTask) => void;
  onToggleDone: (task: WorkTask) => void;
}

const toInput = (t: WorkTask): TaskInput => ({
  parentId: t.parentId, title: t.title, description: t.description, status: t.status, storyPoints: t.storyPoints,
  assigneeId: t.assigneeId, labels: t.labels, links: t.links, startDate: t.startDate, dueDate: t.dueDate,
});

export default function TaskDrawer({ target, tasks, people, teams, config, onClose, onSaved, onNavigate, onDelete, onToggleDone }: Props) {
  const task = target.mode === "edit" ? tasks.find((t) => t.id === target.id) : undefined;
  const parentId = target.mode === "create" ? target.parentId : task?.parentId ?? null;
  const parent = parentId ? tasks.find((t) => t.id === parentId) : undefined;
  const isSub = !!parentId;

  const initial = useMemo<TaskInput>(
    () =>
      task
        ? toInput(task)
        : {
            parentId, title: "", description: "", status: defaultStatus(config), storyPoints: null,
            // Subtasks inherit the parent's dates as a sensible default.
            assigneeId: null, labels: [], links: [], startDate: parent?.startDate ?? null, dueDate: parent?.dueDate ?? null,
          },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target]
  );
  const [form, setForm] = useState<TaskInput>(initial);
  const [errors, setErrors] = useState<TaskErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | (() => void)>(null);
  const [availability, setAvailability] = useState<Map<string, Availability> | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  /** Run `fn` now, or after confirming that unsaved changes may be discarded. */
  const guard = (fn: () => void) => (dirty && !pending ? setConfirm(() => fn) : fn());
  useFocusTrap(ref, () => !confirm && guard(onClose));

  // Availability for the task window (debounced), excluding this task from workload.
  useEffect(() => {
    let cancelled = false;
    setAvailability(null);
    const t = setTimeout(() => {
      getAssigneeAvailability(form.startDate, form.dueDate, task?.id)
        .then((list) => !cancelled && setAvailability(new Map(list.map((a) => [a.userId, a]))))
        .catch(() => !cancelled && setAvailability(new Map()));
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.startDate, form.dueDate, task?.id]);

  const validate = (f: TaskInput) => validateTask(cleanTaskInput(f, config), config, people, tasks, task?.id);
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched.has(key) || errors[key as TaskField]) setErrors(validate(next));
  };
  const blur = (key: TaskField) => {
    setTouched((t) => new Set(t).add(key));
    setErrors(validate(form));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    setTouched(new Set(Object.keys(form)));
    const first = Object.keys(found)[0];
    if (first) return ref.current?.querySelector<HTMLElement>(`#f-${first}`)?.focus();
    setServerError(null);
    start(async () => {
      const res = task ? await updateTask(task.id, form) : await createTask(form);
      if (res.ok) onSaved(task ? `Saved ${res.data.code}` : `Created ${res.data.code} · ${res.data.title}`, res.data);
      else {
        if (res.errors) setErrors(res.errors);
        setServerError(res.message ?? "Please fix the highlighted fields.");
      }
    });
  };

  const err = (k: TaskField) => (touched.has(k) || errors[k] ? errors[k] : undefined);
  const subtasks = task && !isSub ? tasks.filter((t) => t.parentId === task.id).sort((a, b) => a.code.localeCompare(b.code)) : [];
  const labelSuggestions = useMemo(() => [...new Set(tasks.flatMap((t) => t.labels))].sort(), [tasks]);
  const hasWindow = !!(form.startDate || form.dueDate);
  const selectedWarning = form.assigneeId ? availability?.get(form.assigneeId)?.warning : null;
  const doneKey = doneStatus(config);

  return (
    <>
      <div className="overlay" onClick={() => guard(onClose)} />
      <div ref={ref} className="drawer task-drawer" role="dialog" aria-modal="true" aria-labelledby="task-drawer-title">
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            {parent && (
              <button type="button" className="crumb" onClick={() => guard(() => onNavigate({ mode: "edit", id: parent.id }))}>
                ← {parent.code} · {parent.title}
              </button>
            )}
            <h2 id="task-drawer-title">
              {task ? <><span className="code-tag">{task.code}</span> Edit {isSub ? "subtask" : "task"}</> : isSub ? "New subtask" : "Create task"}
            </h2>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => guard(onClose)}><CloseIcon /></button>
        </div>

        <form onSubmit={submit} noValidate style={{ display: "contents" }}>
          <div className="drawer-body">
            {serverError && <div className="alert alert-danger" role="alert">{serverError}</div>}
            {errors.parentId && <div className="alert alert-danger" role="alert">{errors.parentId}</div>}

            <div className="field">
              <label htmlFor="f-title">Title<span className="req" aria-hidden="true"> *</span></label>
              <input id="f-title" className="input" value={form.title} maxLength={140} placeholder="What needs to be done?" aria-invalid={!!err("title") || undefined} aria-describedby={err("title") ? "e-title" : undefined} onChange={(e) => set("title", e.target.value)} onBlur={() => blur("title")} />
              {err("title") && <span id="e-title" className="field-error" role="alert">{err("title")}</span>}
            </div>

            <div className="field">
              <label htmlFor="f-description">Description</label>
              <textarea id="f-description" className="input textarea" rows={3} value={form.description} placeholder="Context, acceptance criteria, notes…" aria-invalid={!!err("description") || undefined} onChange={(e) => set("description", e.target.value)} onBlur={() => blur("description")} />
              {err("description") && <span className="field-error" role="alert">{err("description")}</span>}
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="f-status">Status</label>
                <select id="f-status" className="select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                  {config.statuses.filter((s) => s.active || s.key === initial.status).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-storyPoints">Story points</label>
                <select id="f-storyPoints" className="select" value={form.storyPoints ?? ""} aria-invalid={!!err("storyPoints") || undefined} onChange={(e) => set("storyPoints", e.target.value === "" ? null : Number(e.target.value))}>
                  <option value="">Not estimated</option>
                  {config.storyPoints.filter((p) => p.active || p.value === initial.storyPoints).map((p) => <option key={p.value} value={p.value}>{p.value} · {p.complexity} — {p.label}</option>)}
                </select>
                {err("storyPoints") && <span className="field-error" role="alert">{err("storyPoints")}</span>}
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="f-startDate">Start date</label>
                <input id="f-startDate" className="input" type="date" value={form.startDate ?? ""} aria-invalid={!!err("startDate") || undefined} onChange={(e) => set("startDate", e.target.value || null)} onBlur={() => blur("startDate")} />
                {err("startDate") && <span className="field-error" role="alert">{err("startDate")}</span>}
              </div>
              <div className="field">
                <label htmlFor="f-dueDate">Due date</label>
                <input id="f-dueDate" className="input" type="date" value={form.dueDate ?? ""} min={form.startDate ?? undefined} aria-invalid={!!err("dueDate") || undefined} onChange={(e) => set("dueDate", e.target.value || null)} onBlur={() => blur("dueDate")} />
                {err("dueDate") && <span className="field-error" role="alert">{err("dueDate")}</span>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="f-assigneeId">Assignee</label>
              <AssigneePicker people={people} teams={teams} value={form.assigneeId} availability={availability} hasWindow={hasWindow} invalid={!!err("assigneeId")} onChange={(id) => set("assigneeId", id)} />
              {err("assigneeId") ? (
                <span className="field-error" role="alert">{err("assigneeId")}</span>
              ) : selectedWarning ? (
                <span className="field-warn" role="status"><AlertIcon size={14} /> {selectedWarning}. You can still assign them.</span>
              ) : (
                <span className="field-hint">{hasWindow ? "Availability comes from the roster for the task's dates." : "Add a start or due date to see roster availability."}</span>
              )}
            </div>

            <SmartAssign form={form} taskId={task?.id ?? null} people={people} teams={teams} value={form.assigneeId} onPick={(id) => set("assigneeId", id)} />

            <div className="field">
              <label htmlFor="f-labels">Labels</label>
              <LabelsInput value={form.labels} suggestions={labelSuggestions} max={config.maxLabels} invalid={!!err("labels")} onChange={(l) => set("labels", l)} />
              {err("labels") ? <span className="field-error" role="alert">{err("labels")}</span> : <span className="field-hint">Press Enter or comma to add.</span>}
            </div>

            <div className="field">
              <span className="field-label" id="links-label">Links</span>
              <LinksEditor value={form.links} max={config.maxLinks} onChange={(l) => set("links", l)} />
              {err("links") ? <span className="field-error" role="alert">{err("links")}</span> : <span className="field-hint">Jira issues, GitLab merge requests, GitHub PRs or any URL.</span>}
            </div>

            {!isSub && (
              <section className="subtasks" aria-labelledby="subtasks-title">
                <div className="subtasks-head">
                  <h3 id="subtasks-title">Subtasks {subtasks.length > 0 && <span className="field-hint">({subtasks.filter((s) => s.status === doneKey).length}/{subtasks.length} done)</span>}</h3>
                  {task && (
                    <button type="button" className="btn" style={{ minHeight: 34 }} onClick={() => guard(() => onNavigate({ mode: "create", parentId: task.id }))}>
                      <PlusIcon size={14} /> Add subtask
                    </button>
                  )}
                </div>
                {!task ? (
                  <p className="field-hint">Create the task first, then add subtasks with their own assignee and points.</p>
                ) : subtasks.length === 0 ? (
                  <p className="field-hint">No subtasks yet.</p>
                ) : (
                  <ul className="subtask-list">
                    {subtasks.map((s) => (
                      <li key={s.id} className="subtask-row">
                        <button type="button" className={`check ${s.status === doneKey ? "is-done" : ""}`} aria-pressed={s.status === doneKey} aria-label={`Mark ${s.code} ${s.status === doneKey ? "not done" : "done"}`} onClick={() => onToggleDone(s)} />
                        <button type="button" className="subtask-title" onClick={() => guard(() => onNavigate({ mode: "edit", id: s.id }))}>
                          <span className={s.status === doneKey ? "is-struck" : ""}>{s.title}</span>
                          <span className="code-tag">{s.code}</span>
                        </button>
                        <PointsChip points={s.storyPoints} config={config} />
                        <AssigneeChip person={people.find((p) => p.id === s.assigneeId)} compact />
                        <StatusPill status={s.status} config={config} />
                        <button type="button" className="icon-btn" aria-label={`Delete subtask ${s.code}`} onClick={() => onDelete(s)}><TrashIcon size={15} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <div className="drawer-foot">
            {task && (
              <button type="button" className="btn btn-danger" style={{ marginRight: "auto" }} onClick={() => onDelete(task)} disabled={pending}>
                <TrashIcon size={15} /> Delete
              </button>
            )}
            <button type="button" className="btn" onClick={() => guard(onClose)} disabled={pending}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : task ? "Save changes" : isSub ? "Add subtask" : "Create task"}</button>
          </div>
        </form>
      </div>
      {confirm && (
        <ConfirmDialog title="Discard changes?" confirmLabel="Discard" danger onConfirm={() => { const fn = confirm; setConfirm(null); fn(); }} onCancel={() => setConfirm(null)}>
          You have unsaved changes that will be lost.
        </ConfirmDialog>
      )}
    </>
  );
}
