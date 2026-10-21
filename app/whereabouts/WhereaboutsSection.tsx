"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { fetchRosterMonth } from "../../lib/roster-actions";
import { buildChatText, buildWhereabouts, countPeople, matches, type Group } from "../../lib/whereabouts";
import { dayLabel, shiftDate } from "../../lib/roster-dates";
import type { ShiftConfig } from "../../lib/shifts";
import type { Resource, RosterEntry } from "../roster/types";
import CodeChip from "../roster/CodeChip";
import ToastRegion from "../components/ui/Toast";
import { useToasts } from "../components/ui/useToasts";
import { CalendarIcon, CopyIcon, ClockIcon, ChevronLeft, ChevronRight, SearchIcon, UsersIcon, UserCheckIcon, UserXIcon, HelpIcon, AlertIcon } from "../components/ui/Icons";
import { displayName } from "../lib/ui";

interface Props {
  resources: Resource[];
  entries: RosterEntry[]; // the initial date's month
  config: ShiftConfig;
  initialDate: string;
  today: string;
  loadError: boolean;
}

function Card({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "neutral" | "ok" | "warn" }) {
  return (
    <div className={`wb-card wb-card-${tone}`}>
      <div className="wb-card-top"><span>{label}</span>{icon}</div>
      <div className="wb-card-value" aria-live="polite">{value}</div>
    </div>
  );
}

function Person({ person, code, tag }: { person: Resource; code: string; tag: React.ReactNode }) {
  return (
    <li className="person-card" data-code={code}>
      <div className="person-main">
        <b>{displayName(person.name)}</b>
        <small>{person.employeeId ?? person.email}</small>
      </div>
      {tag}
    </li>
  );
}

export default function WhereaboutsSection({ resources, entries, config, initialDate, today, loadError }: Props) {
  const { toasts, notify } = useToasts();
  const [date, setDate] = useState(initialDate);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const dateInput = useRef<HTMLInputElement>(null);

  // Months already loaded: the server gives us the first one; others are fetched on demand.
  const cache = useRef(new Map<string, RosterEntry[]>());
  cache.current.set(initialDate.slice(0, 7), entries);
  const month = date.slice(0, 7);

  useEffect(() => {
    if (cache.current.has(month)) return;
    let cancelled = false;
    setLoading(true);
    fetchRosterMonth(month).then((res) => {
      if (cancelled) return;
      if (res.error) setFetchError(true);
      else { cache.current.set(month, res.entries); setFetchError(false); }
      setLoading(false);
      rerender();
    });
    return () => { cancelled = true; };
  }, [month]);

  // Debounce the filter (250ms).
  useEffect(() => {
    const t = setTimeout(() => setSearch(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // Mirror the day into the URL (shareable); omit it for "today".
  useEffect(() => {
    const url = new URL(window.location.href);
    if (date === today) url.searchParams.delete("date");
    else url.searchParams.set("date", date);
    window.history.replaceState(null, "", url.pathname + (url.search || ""));
  }, [date, today]);

  const monthEntries = cache.current.get(month);
  const dayEntries = useMemo(() => (monthEntries ?? []).filter((e) => e.date === date), [monthEntries, date]);
  const whereabouts = useMemo(() => buildWhereabouts(resources, dayEntries, config), [resources, dayEntries, config]);
  const codeOf = useMemo(() => new Map(dayEntries.map((e) => [e.userId, e.code])), [dayEntries]);

  const filterGroups = (groups: Group[]): Group[] =>
    groups
      .map((g) => ({ ...g, people: g.people.filter((p) => matches(p, g.def.code, search)) }))
      .filter((g) => g.people.length > 0);
  const working = useMemo(() => filterGroups(whereabouts.working), [whereabouts, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const leave = useMemo(() => filterGroups(whereabouts.leave), [whereabouts, search]); // eslint-disable-line react-hooks/exhaustive-deps
  const unscheduled = useMemo(() => whereabouts.unscheduled.filter((p) => matches(p, codeOf.get(p.id), search)), [whereabouts, search, codeOf]);

  const totalWorking = countPeople(whereabouts.working);
  const totalAway = countPeople(whereabouts.leave);

  const copy = async () => {
    const text = buildChatText(date, whereabouts, displayName);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (e.g. insecure context): fall back to a temporary textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      if (!ok) return notify("error", "Couldn't copy. Select and copy manually.");
    }
    notify("success", `Copied summary for ${dayLabel(date)}`);
  };

  const showSkeleton = loading && !monthEntries;

  return (
    <section className="whereabouts" aria-labelledby="wb-title">
      <div className="wb-head">
        <div>
          <h2 id="wb-title" className="wb-title"><CalendarIcon size={22} /> Daily Whereabouts</h2>
          <p className="page-subtitle">Real-time daily attendance by location: active working shifts and leave records.</p>
        </div>
        <div className="wb-controls">
          <div className="wb-nav" role="group" aria-label="Change day">
            <button type="button" className="icon-btn" aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))}><ChevronLeft size={16} /></button>
            <button type="button" className="wb-today" onClick={() => setDate(today)} disabled={date === today}>Today</button>
            <button type="button" className="icon-btn" aria-label="Next day" onClick={() => setDate(shiftDate(date, 1))}><ChevronRight size={16} /></button>
          </div>
          <button type="button" className="btn" onClick={() => dateInput.current?.showPicker?.()} aria-label={`Selected day ${dayLabel(date)}. Choose another date`}>
            {dayLabel(date)}
          </button>
          <input ref={dateInput} type="date" className="sr-only" tabIndex={-1} aria-hidden="true" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button type="button" className="btn" onClick={copy}><CopyIcon size={16} /> Copy chat text</button>
        </div>
      </div>

      {(loadError || fetchError) && (
        <div className="alert alert-danger" role="alert"><AlertIcon /> Couldn&apos;t load the roster from Google Sheets. Check the connection and sharing settings, then refresh.</div>
      )}

      <div className="wb-cards">
        <Card label="Total Staff" value={whereabouts.total} icon={<UsersIcon size={20} />} tone="neutral" />
        <Card label="Working Shifts" value={totalWorking} icon={<UserCheckIcon size={20} />} tone="ok" />
        <Card label="On Leave / Off" value={totalAway} icon={<UserXIcon size={20} />} tone="warn" />
        <Card label="Unscheduled" value={whereabouts.unscheduled.length} icon={<HelpIcon size={20} />} tone="neutral" />
      </div>

      <div className="search-wrap wb-search">
        <SearchIcon size={16} />
        <input className="search-input" type="search" placeholder="Filter by staff name, ID, or code…" aria-label="Filter staff" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {showSkeleton ? (
        <div className="shimmer skeleton" style={{ height: 260, borderRadius: 16 }} aria-busy="true" aria-label="Loading roster" />
      ) : (
        <>
          <div className="wb-panels">
            <div className="wb-panel wb-panel-ok">
              <div className="wb-panel-head">
                <div><h3><span className="dot dot-ok" />Working Shifts</h3><p>Personnel rostered to active work shifts for this day</p></div>
                <span className="wb-badge wb-badge-ok">{countPeople(working)} rostered</span>
              </div>
              <div className="wb-panel-body">
                {working.length === 0 ? <p className="wb-empty">No staff rostered for this day.</p> : working.map((g) => (
                  <div key={g.def.code} className="wb-shift">
                    <div className="wb-shift-head">
                      <div>
                        <b>{g.def.label}</b>
                        {g.def.start && <span className="wb-time"><ClockIcon size={13} /> {g.def.start} - {g.def.end}</span>}
                      </div>
                      <span className="wb-badge wb-badge-indigo">{g.people.length} {g.people.length === 1 ? "staff" : "staffs"}</span>
                    </div>
                    <ul className="wb-people">
                      {g.people.map((p) => (
                        <Person key={p.id} person={p} code={g.def.code} tag={g.def.start ? <span className="time-chip">{g.def.start} – {g.def.end}</span> : <CodeChip def={g.def} code={g.def.code} />} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="wb-panel wb-panel-warn">
              <div className="wb-panel-head">
                <div><h3><span className="dot dot-warn" />On Leave &amp; Unavailable</h3><p>Personnel on leave, rest off, or scheduled absence</p></div>
                <span className="wb-badge wb-badge-warn">{countPeople(leave)} away</span>
              </div>
              <div className="wb-panel-body">
                {leave.length === 0 ? <p className="wb-empty">No staff on leave for this day.</p> : leave.map((g) => (
                  <div key={g.def.code} className="wb-shift">
                    <div className="wb-shift-head">
                      <div><b>{g.def.label}</b></div>
                      <span className="wb-badge wb-badge-warn">{g.people.length}</span>
                    </div>
                    <ul className="wb-people">
                      {g.people.map((p) => <Person key={p.id} person={p} code={g.def.code} tag={<CodeChip def={g.def} code={g.def.code} />} />)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="wb-unscheduled">
            <h3><HelpIcon size={16} /> Unscheduled Personnel ({unscheduled.length})</h3>
            {unscheduled.length === 0 ? (
              <p className="wb-empty" style={{ padding: "0.5rem 0" }}>{whereabouts.unscheduled.length === 0 ? "Everyone has a roster entry for this day." : "No unscheduled staff match the filter."}</p>
            ) : (
              <>
                <ul className="wb-chips">
                  {unscheduled.map((p) => (
                    <li key={p.id} className="wb-chip"><b>{displayName(p.name)}</b><small>{p.employeeId ?? p.email}</small></li>
                  ))}
                </ul>
                <p className="field-hint" style={{ marginTop: 10 }}>Assign them a shift or leave in the <Link href={`/roster?month=${month}`} style={{ color: "#a8a1ff" }}>Roster →</Link></p>
              </>
            )}
          </div>
        </>
      )}
      <ToastRegion toasts={toasts} />
    </section>
  );
}
