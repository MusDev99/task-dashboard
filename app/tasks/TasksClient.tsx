"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { deleteTask, setTaskStatus } from "../../lib/task-actions";
import { MONTH_RE } from "../../lib/roster-dates";
import { defaultStatus, doneStatus } from "../../lib/task-status";
import type { TaskConfig } from "../../lib/task-config";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import Pagination, { PAGE_SIZES } from "../components/ui/Pagination";
import ToastRegion from "../components/ui/Toast";
import { useToasts } from "../components/ui/useToasts";
import { AlertIcon, CalendarIcon, CheckIcon, PlusIcon, SearchIcon, TableIcon, GridIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";
import ListTreeView, { type TaskSort, type TaskSortKey } from "./ListTreeView";
import KanbanView from "./KanbanView";
import CalendarView from "./CalendarView";
import TaskDrawer, { type DrawerTarget } from "./TaskDrawer";
import type { TaskActions } from "./TaskMenu";
import type { Person, WorkTask } from "./types";
import type { TeamOption } from "../teams/types";

type View = "list" | "kanban" | "calendar";
type Change = { type: "status"; id: string; status: string } | { type: "delete"; ids: string[] };

interface Props {
  tasks: WorkTask[];
  people: Person[];
  teams: TeamOption[];
  config: TaskConfig;
  today: string;
  loadError: boolean;
}

const oneOf = <T extends string>(v: string | null, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);

export default function TasksClient({ tasks, people, teams, config, today, loadError }: Props) {
  const params = useSearchParams();
  const { toasts, notify } = useToasts();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(0);

  // Server data + optimistic overlay (status moves and deletes show instantly, revert on failure).
  const [items, apply] = useOptimistic(tasks, (state: WorkTask[], c: Change) =>
    c.type === "status" ? state.map((t) => (t.id === c.id ? { ...t, status: c.status } : t)) : state.filter((t) => !c.ids.includes(t.id))
  );

  // ── Filters / view state (mirrored to the URL) ──
  // Tabs: active statuses plus any inactive one that still has tasks.
  const statusKeys = ["all", ...config.statuses.filter((s) => s.active || tasks.some((t) => t.status === s.key)).map((s) => s.key)] as const;
  const [q, setQ] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(q);
  const [status, setStatus] = useState<string>(oneOf(params.get("status"), statusKeys, "all"));
  const [assignee, setAssignee] = useState(params.get("assignee") ?? "");
  const [team, setTeam] = useState(teams.some((t) => t.id === params.get("team")) ? params.get("team")! : "");
  const [label, setLabel] = useState(params.get("label") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<View>(oneOf(params.get("view"), ["list", "kanban", "calendar"] as const, "kanban"));
  const [sort, setSort] = useState<TaskSort>(() => {
    const [k, d] = (params.get("sort") ?? "code:desc").split(":");
    return { key: oneOf(k, ["code", "title", "status", "points", "due"] as const, "code"), dir: d === "asc" ? "asc" : "desc" };
  });
  const [size, setSize] = useState(Number(params.get("size")) || PAGE_SIZES[0]);
  const [page, setPage] = useState(Math.max(1, Number(params.get("page")) || 1));
  const [month, setMonth] = useState(MONTH_RE.test(params.get("month") ?? "") ? params.get("month")! : today.slice(0, 7));
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [deleting, setDeleting] = useState<WorkTask | null>(null);

  useEffect(() => {
    if (q === search) return;
    const t = setTimeout(() => { setSearch(q); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status !== "all") next.set("status", status);
    if (assignee) next.set("assignee", assignee);
    if (team) next.set("team", team);
    if (label) next.set("label", label);
    if (view !== "kanban") next.set("view", view);
    if (sort.key !== "code" || sort.dir !== "desc") next.set("sort", `${sort.key}:${sort.dir}`);
    if (size !== PAGE_SIZES[0]) next.set("size", String(size));
    if (page > 1) next.set("page", String(page));
    if (view === "calendar" && month !== today.slice(0, 7)) next.set("month", month);
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [search, status, assignee, team, label, view, sort, size, page, month, today]);

  // ── Derived data ──
  const peopleMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const subtasksOf = useMemo(() => {
    const m = new Map<string, WorkTask[]>();
    for (const t of items) if (t.parentId) m.set(t.parentId, [...(m.get(t.parentId) ?? []), t]);
    for (const list of m.values()) list.sort((a, b) => a.code.localeCompare(b.code));
    return m;
  }, [items]);
  const top = useMemo(() => items.filter((t) => !t.parentId), [items]);
  const allLabels = useMemo(() => [...new Set(items.flatMap((t) => t.labels))].sort((a, b) => a.localeCompare(b)), [items]);

  const teamMembers = useMemo(() => (team ? new Set(teams.find((x) => x.id === team)?.memberIds ?? []) : null), [teams, team]);
  const baseFiltered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return top.filter((t) => {
      const subs = subtasksOf.get(t.id) ?? [];
      // Team = the task or one of its subtasks is assigned to a member (tasks never store a team).
      if (teamMembers && ![t, ...subs].some((x) => x.assigneeId && teamMembers.has(x.assigneeId))) return false;
      if (assignee === "unassigned" ? !!t.assigneeId : assignee && t.assigneeId !== assignee && !subs.some((s) => s.assigneeId === assignee)) return false;
      if (label && !t.labels.includes(label) && !subs.some((s) => s.labels.includes(label))) return false;
      if (!needle) return true;
      const hay = [t.code, t.title, t.description, ...t.labels, ...subs.flatMap((s) => [s.code, s.title])];
      return hay.some((v) => v.toLowerCase().includes(needle));
    });
  }, [top, subtasksOf, search, assignee, label, teamMembers]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: baseFiltered.length };
    for (const s of config.statuses) c[s.key] = baseFiltered.filter((t) => t.status === s.key).length;
    return c;
  }, [baseFiltered, config]);

  const filtered = useMemo(() => {
    const list = status === "all" ? baseFiltered : baseFiltered.filter((t) => t.status === status);
    const order = new Map(config.statuses.map((s, i) => [s.key, i]));
    const cmp: Record<TaskSortKey, (a: WorkTask, b: WorkTask) => number> = {
      code: (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }),
      title: (a, b) => a.title.localeCompare(b.title),
      status: (a, b) => (order.get(a.status) ?? 99) - (order.get(b.status) ?? 99),
      points: (a, b) => (a.storyPoints ?? -1) - (b.storyPoints ?? -1),
      due: (a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
    };
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => dir * cmp[sort.key](a, b));
  }, [baseFiltered, status, sort, config]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * size, safePage * size);
  const calendarItems = useMemo(() => filtered.flatMap((t) => [t, ...(subtasksOf.get(t.id) ?? [])]), [filtered, subtasksOf]);
  const hasFilters = !!(search || assignee || team || label || status !== "all");

  // ── Mutations ──
  const track = useCallback(async <T,>(fn: () => Promise<T>) => {
    setSaving((n) => n + 1);
    try { return await fn(); } finally { setSaving((n) => n - 1); }
  }, []);

  const changeStatus = useCallback((task: WorkTask, next: string) => {
    if (task.status === next) return;
    // The card re-mounts in its new lane; keep keyboard focus on it instead of losing it to <body>.
    const active = document.activeElement;
    const fromMenu = !active || active === document.body || !!active.closest("[role=menu]");
    if (fromMenu) setTimeout(() => document.querySelector<HTMLElement>(`[aria-label="Actions for ${task.code}"]`)?.focus(), 50);
    startTransition(async () => {
      apply({ type: "status", id: task.id, status: next });
      const res = await track(() => setTaskStatus(task.id, next));
      const label = config.statuses.find((s) => s.key === next)?.label ?? next;
      if (res.ok) notify("success", `${task.code} moved to ${label}`);
      else notify("error", res.message ?? "Couldn't update the status. It was reverted.");
    });
  }, [apply, config, notify, track]);

  const doneKey = doneStatus(config);
  const todoKey = defaultStatus(config);
  const actions: TaskActions = useMemo(() => ({
    onOpen: (id) => setDrawer({ mode: "edit", id }),
    onAddSubtask: (parentId) => setDrawer({ mode: "create", parentId }),
    onStatus: changeStatus,
    onDelete: (t) => setDeleting(t),
    onToggleDone: (t) => changeStatus(t, t.status === doneKey ? todoKey : doneKey),
  }), [changeStatus, doneKey, todoKey]);

  const confirmDelete = () => {
    if (!deleting) return;
    const target = deleting;
    const subIds = (subtasksOf.get(target.id) ?? []).map((s) => s.id);
    setDeleting(null);
    // Close the drawer if it shows the deleted task (or one of its subtasks).
    if (drawer?.mode === "edit" && [target.id, ...subIds].includes(drawer.id)) setDrawer(target.parentId ? { mode: "edit", id: target.parentId } : null);
    startTransition(async () => {
      apply({ type: "delete", ids: [target.id, ...subIds] });
      const res = await track(() => deleteTask(target.id));
      if (res.ok) {
        const n = res.data.subtasksDeleted;
        notify("success", `Deleted ${target.code}${n ? ` and ${n} subtask${n === 1 ? "" : "s"}` : ""}`);
      } else notify("error", res.message ?? "Couldn't delete the task.");
    });
  };

  const deletingSubs = deleting ? (subtasksOf.get(deleting.id) ?? []).length : 0;
  const pickView = (v: View) => { setView(v); setPage(1); };
  const clearFilters = () => { setQ(""); setSearch(""); setStatus("all"); setAssignee(""); setTeam(""); setLabel(""); setPage(1); };

  const activeFilters = [assignee, team, label].filter(Boolean).length;

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-header task-page-header">
        <div className="task-heading">
          <span className="task-heading-icon" aria-hidden="true"><CheckIcon size={22} /></span>
          <div>
            <h1 className="page-title">Task Management</h1>
            <p className="page-subtitle">Plan, coordinate and assign operational tasks, checklists and timelines — based on who&apos;s available on the roster.</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-lg fab" onClick={() => setDrawer({ mode: "create", parentId: null })}>
          <PlusIcon size={16} /> Create Task
        </button>
      </div>

      {loadError && <div className="alert alert-danger" role="alert"><AlertIcon /> Couldn&apos;t load tasks. Please refresh. If it keeps happening, contact an administrator.</div>}

      <div className="toolbar">
        <div className="search-wrap" style={{ maxWidth: 520 }}>
          <SearchIcon size={16} />
          <input className="search-input" type="search" placeholder="Search by title, code, description, label or subtasks…" aria-label="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" className="btn filter-toggle" aria-expanded={filtersOpen} aria-controls="task-filters" onClick={() => setFiltersOpen((o) => !o)}>
          Filters{activeFilters > 0 ? ` · ${activeFilters}` : ""}
        </button>
        <div id="task-filters" className={`filter-group ${filtersOpen ? "is-open" : ""}`}>
        <select className="select" aria-label="Filter by assignee" value={assignee} onChange={(e) => { setAssignee(e.target.value); setPage(1); }}>
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {people.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{displayName(p.name)}</option>)}
        </select>
        {teams.length > 0 && (
          <select className="select" aria-label="Filter by team" value={team} onChange={(e) => { setTeam(e.target.value); setPage(1); }}>
            <option value="">All teams</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <select className="select" aria-label="Filter by label" value={label} onChange={(e) => { setLabel(e.target.value); setPage(1); }}>
          <option value="">All labels</option>
          {allLabels.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        </div>
        {saving > 0 && <span className="field-hint" aria-live="polite" style={{ color: "var(--accent-amber)" }}>Saving…</span>}
      </div>

      <div className="task-bar">
        <div className="seg seg-status" role="group" aria-label="Filter by status">
          {statusKeys.map((k) => (
            <button key={k} type="button" aria-pressed={status === k} onClick={() => { setStatus(k); setPage(1); }}>
              {k === "all" ? "All statuses" : config.statuses.find((s) => s.key === k)!.label}
              <span className="seg-count">{counts[k] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="seg seg-views" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "list"} onClick={() => pickView("list")}><TableIcon size={15} /> List Tree</button>
          <button type="button" aria-pressed={view === "kanban"} onClick={() => pickView("kanban")}><GridIcon size={15} /> Kanban</button>
          <button type="button" aria-pressed={view === "calendar"} onClick={() => pickView("calendar")}><CalendarIcon size={15} /> Calendar</button>
        </div>
      </div>

      {top.length === 0 ? (
        <div className="table-card"><div className="empty-state">
          <h3>No tasks yet</h3>
          <p>Create the first task, estimate it and assign it to someone who&apos;s available.</p>
          <button type="button" className="btn btn-primary" onClick={() => setDrawer({ mode: "create", parentId: null })}><PlusIcon size={16} /> Create Task</button>
        </div></div>
      ) : filtered.length === 0 && view !== "kanban" ? (
        <div className="table-card"><div className="empty-state">
          <h3>No tasks match</h3>
          <p>Try another search term or clear the filters.</p>
          {hasFilters && <button type="button" className="btn" onClick={clearFilters}>Clear filters</button>}
        </div></div>
      ) : view === "list" ? (
        <div className="table-card">
          <ListTreeView tasks={visible} subtasksOf={subtasksOf} people={peopleMap} config={config} today={today} sort={sort} actions={actions}
            onSort={(k) => { setSort((s) => (s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: k === "title" ? "asc" : "desc" })); setPage(1); }} />
          <Pagination page={safePage} size={size} total={filtered.length} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />
        </div>
      ) : view === "kanban" ? (
        <KanbanView tasks={filtered} subtasksOf={subtasksOf} people={peopleMap} config={config} today={today} actions={actions} />
      ) : (
        <CalendarView tasks={calendarItems} people={peopleMap} config={config} month={month} today={today} onMonth={setMonth} onOpen={actions.onOpen} />
      )}

      {drawer && (
        <TaskDrawer
          key={drawer.mode === "edit" ? drawer.id : `new-${drawer.parentId ?? "top"}`}
          target={drawer}
          tasks={items}
          people={people}
          teams={teams}
          config={config}
          onClose={() => setDrawer(null)}
          onNavigate={setDrawer}
          onDelete={(t) => setDeleting(t)}
          onToggleDone={actions.onToggleDone}
          onSaved={(message, task) => {
            notify("success", message);
            // After adding/editing a subtask, return to its parent; otherwise close.
            setDrawer(task.parentId ? { mode: "edit", id: task.parentId } : null);
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog title={`Delete ${deleting.code}?`} confirmLabel={deleting.parentId ? "Delete subtask" : "Delete task"} danger onConfirm={confirmDelete} onCancel={() => setDeleting(null)}>
          “{deleting.title}” will be permanently removed{deletingSubs > 0 ? `, together with its ${deletingSubs} subtask${deletingSubs === 1 ? "" : "s"}` : ""}. This can&apos;t be undone.
        </ConfirmDialog>
      )}

      <ToastRegion toasts={toasts} />
    </div>
  );
}
