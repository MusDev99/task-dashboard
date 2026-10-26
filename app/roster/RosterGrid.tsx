"use client";

import { memo, useMemo } from "react";
import Avatar from "../components/ui/Avatar";
import CodeChip from "./CodeChip";
import { displayName } from "../lib/ui";
import { monthDays, type MonthDay } from "./days";
import type { ShiftCode } from "../../lib/shifts";
import type { Resource } from "./types";

// Unit separator: never part of a code, so joining/splitting a row is lossless.
const SEP = "\u001f";

export interface Selection { userId: string; a: number; b: number }

interface Props {
  resources: Resource[];
  month: string;
  today: string;
  codes: Map<string, ShiftCode>;
  values: Map<string, string>; // `${userId}|${date}` -> code
  selection: Selection | null;
  focus: { row: number; day: number };
  focusedUser: string | null;
  onPointerDown: (userId: string, day: number, e: React.PointerEvent) => void;
  onPointerEnter: (userId: string, day: number) => void;
  onKeyDown: (e: React.KeyboardEvent, row: number, day: number) => void;
  onFocusCell: (row: number, day: number) => void;
  onHeaderAssign: (day: number, el: HTMLElement) => void;
  onSelectResource: (userId: string) => void;
}

interface RowProps {
  r: Resource;
  row: number;
  days: MonthDay[];
  codes: Map<string, ShiftCode>;
  /** The row's codes joined by SEP: a cheap value for memo comparison, so editing one row re-renders only that row. */
  rowCodes: string;
  selLo: number;
  selHi: number;
  focusDay: number;
  focused: boolean;
  onPointerDown: Props["onPointerDown"];
  onPointerEnter: Props["onPointerEnter"];
  onKeyDown: Props["onKeyDown"];
  onFocusCell: Props["onFocusCell"];
  onSelectResource: Props["onSelectResource"];
}

const RosterRow = memo(function RosterRow(p: RowProps) {
  const name = displayName(p.r.name);
  const rowCodes = p.rowCodes.split(SEP);
  return (
    <tr>
      <th scope="row" className={`roster-resource ${p.focused ? "is-focused" : ""}`}>
        <button type="button" className="roster-resource-btn" aria-pressed={p.focused} onClick={() => p.onSelectResource(p.r.id)} title="Show this resource's stats">
          <Avatar id={p.r.id} name={p.r.name} src={p.r.avatar} size="sm" />
          <span className="roster-resource-text">
            <b>{name}</b>
            <small>{p.r.employeeId ?? p.r.email}{p.r.locationName ? ` · ${p.r.locationName}` : ""}</small>
          </span>
        </button>
      </th>
      {p.days.map(({ d, longLabel, weekend, isToday }, i) => {
        const code = rowCodes[i];
        const sel = d >= p.selLo && d <= p.selHi;
        return (
          <td
            key={d}
            role="gridcell"
            aria-selected={sel ? true : undefined}
            className={`roster-cell${sel ? " is-selected" : ""}${isToday ? " is-today" : ""}${weekend ? " is-weekend" : ""}`}
          >
            <button
              type="button"
              data-cell={`${p.row}-${d}`}
              tabIndex={p.focusDay === d ? 0 : -1}
              aria-label={`${name}, ${longLabel}: ${code ? p.codes.get(code)?.label ?? code : "no entry"}`}
              onPointerDown={(e) => p.onPointerDown(p.r.id, d, e)}
              onPointerEnter={() => p.onPointerEnter(p.r.id, d)}
              onKeyDown={(e) => p.onKeyDown(e, p.row, d)}
              onFocus={() => p.onFocusCell(p.row, d)}
            >
              {code && <CodeChip def={p.codes.get(code)} code={code} />}
            </button>
          </td>
        );
      })}
    </tr>
  );
});

function RosterGrid(p: Props) {
  const days = useMemo(() => monthDays(p.month, p.today), [p.month, p.today]);
  const phDays = useMemo(() => {
    const s = new Set<number>();
    for (const r of p.resources) for (const { d, date } of days) if (p.values.get(`${r.id}|${date}`) === "PH") s.add(d);
    return s;
  }, [p.resources, p.values, days]);

  return (
    <div className="table-card">
      <div className="table-scroll roster-scroll">
        <table className="roster-grid" role="grid" aria-label="Roster" aria-rowcount={p.resources.length + 1} aria-colcount={days.length + 1}>
          <thead>
            <tr>
              <th scope="col" className="roster-resource-head" rowSpan={2}>Resource</th>
              {days.map(({ d, date }) => (
                <th key={d} scope="col" className="roster-plus">
                  <button type="button" className="roster-plus-btn" aria-label={`Assign ${date} for all shown resources`} onClick={(e) => p.onHeaderAssign(d, e.currentTarget)}>+</button>
                  {phDays.has(d) && <span className="ph-badge" title="Public holiday">PH</span>}
                </th>
              ))}
            </tr>
            <tr>
              {days.map(({ d, short, longLabel, weekend, isToday }) => (
                <th key={d} scope="col" className={`roster-day${isToday ? " is-today" : ""}${weekend ? " is-weekend" : ""}`} aria-label={longLabel}>
                  <div className="roster-day-inner">
                    <span>{short}</span>
                    <b>{d}</b>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.resources.map((r, row) => {
              const sel = p.selection?.userId === r.id ? p.selection : null;
              return (
                <RosterRow
                  key={r.id}
                  r={r}
                  row={row}
                  days={days}
                  codes={p.codes}
                  rowCodes={days.map(({ date }) => p.values.get(`${r.id}|${date}`) ?? "").join(SEP)}
                  selLo={sel ? Math.min(sel.a, sel.b) : 0}
                  selHi={sel ? Math.max(sel.a, sel.b) : -1}
                  focusDay={p.focus.row === row ? p.focus.day : 0}
                  focused={p.focusedUser === r.id}
                  onPointerDown={p.onPointerDown}
                  onPointerEnter={p.onPointerEnter}
                  onKeyDown={p.onKeyDown}
                  onFocusCell={p.onFocusCell}
                  onSelectResource={p.onSelectResource}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(RosterGrid);
