"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCells, clearCells, clearSchedule } from "../../lib/roster-actions";
import { dateOf, daysInMonth, monthLabel, shiftMonth, MONTH_RE } from "../../lib/roster-dates";
import type { ShiftConfig } from "../../lib/shifts";
import RosterGrid, { type Selection } from "./RosterGrid";
import CellPicker from "./CellPicker";
import ResourcePicker from "./ResourcePicker";
import Legend from "./Legend";
import SummaryCards from "./SummaryCards";
import ClearScheduleDialog from "./ClearScheduleDialog";
import UploadCsvDialog from "./UploadCsvDialog";
import ToastRegion from "../components/ui/Toast";
import { useToasts } from "../components/ui/useToasts";
import { ChevronLeft, ChevronRight, AlertIcon } from "../components/ui/Icons";
import { download, toCsv } from "./csv";
import { displayName } from "../lib/ui";
import type { CellRef, Resource, RosterEntry } from "./types";

const key = (userId: string, date: string) => `${userId}|${date}`;

interface Props {
  resources: Resource[];
  entries: RosterEntry[];
  config: ShiftConfig;
  month: string;
  today: string;
  loadError: boolean;
}

interface PickerState {
  anchor: DOMRect;
  title: string;
  subtitle: string;
  cells: CellRef[];
}

export default function RosterClient({ resources, entries, config, month, today, loadError }: Props) {
  const router = useRouter();
  const { toasts, notify } = useToasts();
  const [navPending, startNav] = useTransition();
  const [saving, startSave] = useTransition();

  // Server state + optimistic overlay: edits show instantly and revert automatically if the action fails.
  const base = useMemo(() => new Map(entries.map((e) => [key(e.userId, e.date), e.code])), [entries]);
  const [values, applyOptimistic] = useOptimistic(base, (state, u: { cells: CellRef[]; code: string | null }) => {
    const next = new Map(state);
    for (const c of u.cells) {
      if (u.code) next.set(key(c.userId, c.date), u.code);
      else next.delete(key(c.userId, c.date));
    }
    return next;
  });

  const codes = useMemo(() => new Map(config.codes.map((c) => [c.code, c])), [config]);
  const days = daysInMonth(month);

  // Filters
  const [picked, setPicked] = useState<Set<string>>(() => new Set(resources.map((r) => r.id)));
  const [location, setLocation] = useState("");
  const [focusedUser, setFocusedUser] = useState<string | null>(null);
  const locations = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of resources) if (r.locationId) m.set(r.locationId, r.locationName ?? r.locationId);
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [resources]);
  const shown = useMemo(() => resources.filter((r) => picked.has(r.id) && (!location || r.locationId === location)), [resources, picked, location]);

  // Selection / picker / focus
  const [selection, setSelection] = useState<Selection | null>(null);
  const selRef = useRef<Selection | null>(null);
  const dragging = useRef(false);
  const lastCell = useRef<HTMLElement | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [focus, setFocus] = useState({ row: 0, day: 1 });
  const [dialog, setDialog] = useState<"clear" | "upload" | null>(null);
  const gridWrap = useRef<HTMLDivElement>(null);

  const setSel = (s: Selection | null) => { selRef.current = s; setSelection(s); };
  const closePicker = useCallback(() => { setPicker(null); setSel(null); }, []);

  const cellsOfSelection = (s: Selection): CellRef[] => {
    const [lo, hi] = [Math.min(s.a, s.b), Math.max(s.a, s.b)];
    return Array.from({ length: hi - lo + 1 }, (_, i) => ({ userId: s.userId, date: dateOf(month, lo + i) }));
  };

  const openPickerForSelection = (el: HTMLElement | null) => {
    const s = selRef.current;
    if (!s || !el) return;
    const user = resources.find((r) => r.id === s.userId)!;
    const cells = cellsOfSelection(s);
    setPicker({
      anchor: el.getBoundingClientRect(),
      title: displayName(user.name),
      subtitle: cells.length === 1 ? cells[0].date : `${cells[0].date} → ${cells[cells.length - 1].date} (${cells.length} days)`,
      cells,
    });
  };

  // Finish a drag on pointer release anywhere.
  useEffect(() => {
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      openPickerForSelection(lastCell.current);
    };
    const cancel = () => { dragging.current = false; setSel(null); };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources, month]);

  const onPointerDown = useCallback((userId: string, day: number, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastCell.current = e.currentTarget as HTMLElement;
    setSel({ userId, a: day, b: day });
  }, []);
  const onPointerEnter = useCallback((userId: string, day: number) => {
    const s = selRef.current;
    if (!dragging.current || !s || s.userId !== userId) return;
    const row = shown.findIndex((r) => r.id === userId);
    const el = gridWrap.current?.querySelector<HTMLElement>(`[data-cell="${row}-${day}"]`);
    if (el) lastCell.current = el;
    setSel({ ...s, b: day });
  }, [shown]);

  const focusCell = (row: number, day: number) => {
    const r = Math.max(0, Math.min(shown.length - 1, row));
    const d = Math.max(1, Math.min(days, day));
    setFocus({ row: r, day: d });
    gridWrap.current?.querySelector<HTMLElement>(`[data-cell="${r}-${d}"]`)?.focus();
  };

  const onKeyDown = useCallback((e: React.KeyboardEvent, row: number, day: number) => {
    const user = shown[row];
    if (!user) return;
    const move: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (move[e.key]) {
      e.preventDefault();
      const [dr, dd] = move[e.key];
      if (e.shiftKey && dr === 0) {
        const s = selRef.current?.userId === user.id ? selRef.current : { userId: user.id, a: day, b: day };
        const nb = Math.max(1, Math.min(days, s.b + dd));
        setSel({ ...s, b: nb });
        focusCell(row, nb);
      } else {
        setSel(null);
        focusCell(row + dr, day + dd);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!selRef.current || selRef.current.userId !== user.id) setSel({ userId: user.id, a: day, b: day });
      openPickerForSelection(e.currentTarget as HTMLElement);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const s = selRef.current?.userId === user.id ? selRef.current : { userId: user.id, a: day, b: day };
      apply(cellsOfSelection(s), null);
      setSel(null);
    } else if (e.key === "Escape") setSel(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, days, month]);

  const onHeaderAssign = useCallback((day: number, el: HTMLElement) => {
    const date = dateOf(month, day);
    setSel(null);
    setPicker({
      anchor: el.getBoundingClientRect(),
      title: `${date} · all shown`,
      subtitle: `Applies to ${shown.length} ${shown.length === 1 ? "resource" : "resources"}`,
      cells: shown.map((r) => ({ userId: r.id, date })),
    });
  }, [month, shown]);

  // Mutations (optimistic)
  function apply(cells: CellRef[], code: string | null) {
    if (cells.length === 0) return;
    startSave(async () => {
      applyOptimistic({ cells, code });
      const res = code ? await setCells(cells, code) : await clearCells(cells);
      if (!res.ok) return notify("error", res.message ?? "Couldn't save. Your change was reverted.");
      const n = res.data.count;
      notify("success", code ? `Set ${code} on ${n} ${n === 1 ? "day" : "days"}` : `Cleared ${n} ${n === 1 ? "entry" : "entries"}`);
    });
  }
  const pick = (code: string | null) => {
    if (!picker) return;
    const cells = picker.cells;
    closePicker();
    apply(cells, code);
  };

  // Stats (for the focused resource, otherwise everyone shown)
  const statUsers = focusedUser ? shown.filter((r) => r.id === focusedUser) : shown;
  const stats = useMemo(() => {
    let hours = 0, leave = 0;
    for (const r of statUsers) {
      for (let d = 1; d <= days; d++) {
        const def = codes.get(values.get(key(r.id, dateOf(month, d))) ?? "");
        if (!def) continue;
        hours += def.hours;
        if (def.type === "leave") leave++;
      }
    }
    return { hours, avgWeek: hours / (days / 7), leave };
  }, [statUsers, values, codes, month, days]);
  const totalShownHours = useMemo(() => {
    let h = 0;
    for (const r of shown) for (let d = 1; d <= days; d++) h += codes.get(values.get(key(r.id, dateOf(month, d))) ?? "")?.hours ?? 0;
    return h;
  }, [shown, values, codes, month, days]);

  const countFor = useCallback((userId: string) => {
    let n = 0;
    for (let d = 1; d <= days; d++) if (values.has(key(userId, dateOf(month, d)))) n++;
    return n;
  }, [values, month, days]);

  const goMonth = (m: string) => {
    if (!MONTH_RE.test(m)) return;
    setSel(null);
    startNav(() => router.push(m === today.slice(0, 7) ? "/roster" : `/roster?month=${m}`));
  };

  const exportCsv = () => {
    const rows: string[][] = [["employeeId", "name", "email", "date", "type", "code"]];
    for (const r of shown) {
      for (let d = 1; d <= days; d++) {
        const date = dateOf(month, d);
        const code = values.get(key(r.id, date));
        if (code) rows.push([r.employeeId ?? "", displayName(r.name), r.email, date, codes.get(code)?.type ?? "", code]);
      }
    }
    download(`roster-${month}.csv`, toCsv(rows));
    notify("success", `Exported ${rows.length - 1} entries`);
  };

  const [clearing, startClear] = useTransition();
  const confirmClear = (userIds: string[]) =>
    startClear(async () => {
      const res = await clearSchedule(userIds, month);
      setDialog(null);
      if (res.ok) notify("success", `Cleared ${res.data.count} ${res.data.count === 1 ? "entry" : "entries"}`);
      else notify("error", res.message ?? "Couldn't clear the schedule.");
    });

  const scope = focusedUser ? displayName(resources.find((r) => r.id === focusedUser)?.name ?? "") : `${shown.length} shown`;

  return (
    <div className="page" style={{ maxWidth: "none" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Roster</h1>
          <p className="page-subtitle">View every resource&apos;s shifts and leave for the month. Click or drag cells to update.</p>
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="view-toggle" style={{ display: "inline-flex" }} role="group" aria-label="Month">
            <button type="button" aria-label="Previous month" onClick={() => goMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Next month" onClick={() => goMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button>
          </div>
          <label className="sr-only" htmlFor="month-input">Month</label>
          <input id="month-input" className="input" type="month" value={month} style={{ width: 170, minHeight: 40 }} onChange={(e) => goMonth(e.target.value)} />
          <button type="button" className="btn" onClick={() => goMonth(today.slice(0, 7))} disabled={month === today.slice(0, 7)}>Today</button>
        </div>
      </div>

      {loadError && (
        <div className="alert alert-danger" role="alert"><AlertIcon /> Couldn&apos;t load the roster. Please refresh. If it keeps happening, contact an administrator.</div>
      )}

      <div className="toolbar">
        <ResourcePicker resources={resources} selected={picked} onChange={setPicked} />
        <select className="select" aria-label="Filter by location" value={location} onChange={(e) => setLocation(e.target.value)}>
          <option value="">All locations</option>
          {locations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <span className="page-subtitle" aria-live="polite">
          {shown.length} of {resources.length} shown · {totalShownHours}h this month · {monthLabel(month)}
          {(saving || navPending) && <span style={{ marginLeft: 8, color: "var(--accent-amber)" }}>Saving…</span>}
        </span>
      </div>
      <div className="toolbar">
        <Legend codes={config.codes.filter((c) => c.active)} />
        <button type="button" className="btn" onClick={() => setDialog("clear")}>Clear schedule</button>
        <button type="button" className="btn" onClick={exportCsv} disabled={shown.length === 0}>Export</button>
        <button type="button" className="btn" onClick={() => setDialog("upload")}>Upload CSV</button>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <SummaryCards scope={scope} totalHours={stats.hours} avgPerWeek={stats.avgWeek} leaveDays={stats.leave} />
        {focusedUser && (
          <button type="button" className="btn" style={{ minHeight: 32, marginTop: 8, fontSize: "0.75rem" }} onClick={() => setFocusedUser(null)}>
            Showing {scope} · show all
          </button>
        )}
      </div>

      <p className="page-subtitle" style={{ fontSize: "0.8rem", marginBottom: "0.75rem" }}>
        <b>Tip:</b> click a name to load their stats · click or drag cells on one row to assign a range · use <b>+</b> above a date to assign it for everyone shown · arrow keys + Enter work too.
      </p>

      <div ref={gridWrap}>
        {shown.length === 0 ? (
          <div className="table-card"><div className="empty-state">
            <h3>{resources.length === 0 ? "No active resources" : "No resources match"}</h3>
            <p>{resources.length === 0 ? "Add or activate users on the Users page." : "Adjust the resource or location filter."}</p>
          </div></div>
        ) : (
          <RosterGrid
            resources={shown} month={month} days={days} today={today} codes={codes} values={values}
            selection={selection} focus={focus} focusedUser={focusedUser}
            onPointerDown={onPointerDown} onPointerEnter={onPointerEnter} onKeyDown={onKeyDown}
            onFocusCell={(row, day) => setFocus({ row, day })} onHeaderAssign={onHeaderAssign}
            onSelectResource={(id) => setFocusedUser((f) => (f === id ? null : id))}
          />
        )}
      </div>

      {picker && <CellPicker anchor={picker.anchor} title={picker.title} subtitle={picker.subtitle} codes={config.codes.filter((c) => c.active)} onPick={pick} onClose={closePicker} />}
      {dialog === "clear" && <ClearScheduleDialog resources={resources} monthLabel={monthLabel(month)} countFor={countFor} pending={clearing} onConfirm={confirmClear} onCancel={() => setDialog(null)} />}
      {dialog === "upload" && <UploadCsvDialog onCancel={() => setDialog(null)} onDone={(m) => { setDialog(null); notify("success", m); router.refresh(); }} />}
      <ToastRegion toasts={toasts} />
    </div>
  );
}
