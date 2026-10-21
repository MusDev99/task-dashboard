"use client";

import { memo } from "react";
import Avatar from "../components/ui/Avatar";
import CodeChip from "./CodeChip";
import { displayName } from "../lib/ui";
import { dateOf, weekday } from "../../lib/roster-dates";
import type { ShiftCode } from "../../lib/shifts";
import type { Resource } from "./types";

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface Selection { userId: string; a: number; b: number }

interface Props {
  resources: Resource[];
  month: string;
  days: number;
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

function RosterGrid(p: Props) {
  const dayList = Array.from({ length: p.days }, (_, i) => i + 1);
  const phDays = new Set<number>();
  for (const r of p.resources) for (const d of dayList) if (p.values.get(`${r.id}|${dateOf(p.month, d)}`) === "PH") phDays.add(d);

  return (
    <div className="table-card">
      <div className="table-scroll roster-scroll">
        <table className="roster-grid" role="grid" aria-label="Roster" aria-rowcount={p.resources.length + 1} aria-colcount={p.days + 1}>
          <thead>
            <tr>
              <th scope="col" className="roster-resource-head" rowSpan={2}>Resource</th>
              {dayList.map((d) => (
                <th key={d} scope="col" className="roster-plus">
                  <button type="button" className="roster-plus-btn" aria-label={`Assign ${dateOf(p.month, d)} for all shown resources`} onClick={(e) => p.onHeaderAssign(d, e.currentTarget)}>+</button>
                  {phDays.has(d) && <span className="ph-badge" title="Public holiday">PH</span>}
                </th>
              ))}
            </tr>
            <tr>
              {dayList.map((d) => {
                const date = dateOf(p.month, d);
                const wd = weekday(date);
                return (
                  <th key={d} scope="col" className={`roster-day ${date === p.today ? "is-today" : ""} ${wd === 0 || wd === 6 ? "is-weekend" : ""}`} aria-label={`${WEEKDAY_LONG[wd]} ${d}`}>
                    <div className="roster-day-inner">
                      <span>{WEEKDAY[wd]}</span>
                      <b>{d}</b>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {p.resources.map((r, row) => (
              <tr key={r.id}>
                <th scope="row" className={`roster-resource ${p.focusedUser === r.id ? "is-focused" : ""}`}>
                  <button type="button" className="roster-resource-btn" aria-pressed={p.focusedUser === r.id} onClick={() => p.onSelectResource(r.id)} title="Show this resource's stats">
                    <Avatar id={r.id} name={r.name} src={r.avatar} size="sm" />
                    <span className="roster-resource-text">
                      <b>{displayName(r.name)}</b>
                      <small>{r.employeeId ?? r.email}{r.locationName ? ` · ${r.locationName}` : ""}</small>
                    </span>
                  </button>
                </th>
                {dayList.map((d) => {
                  const date = dateOf(p.month, d);
                  const code = p.values.get(`${r.id}|${date}`);
                  const sel = p.selection && p.selection.userId === r.id && d >= Math.min(p.selection.a, p.selection.b) && d <= Math.max(p.selection.a, p.selection.b);
                  const wd = weekday(date);
                  const isFocus = p.focus.row === row && p.focus.day === d;
                  return (
                    <td
                      key={d}
                      role="gridcell"
                      aria-selected={sel ? true : undefined}
                      className={`roster-cell ${sel ? "is-selected" : ""} ${date === p.today ? "is-today" : ""} ${wd === 0 || wd === 6 ? "is-weekend" : ""}`}
                    >
                      <button
                        type="button"
                        data-cell={`${row}-${d}`}
                        tabIndex={isFocus ? 0 : -1}
                        aria-label={`${displayName(r.name)}, ${WEEKDAY_LONG[wd]} ${d}: ${code ? p.codes.get(code)?.label ?? code : "no entry"}`}
                        onPointerDown={(e) => p.onPointerDown(r.id, d, e)}
                        onPointerEnter={() => p.onPointerEnter(r.id, d)}
                        onKeyDown={(e) => p.onKeyDown(e, row, d)}
                        onFocus={() => p.onFocusCell(row, d)}
                      >
                        {code && <CodeChip def={p.codes.get(code)} code={code} />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(RosterGrid);
