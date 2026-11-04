"use client";

import { useMemo, useState } from "react";
import Pagination from "../components/ui/Pagination";
import { AlertIcon } from "../components/ui/Icons";
import { AUDIT_ENTITIES, AUDIT_ENTITY_LABELS, filterAudit, paginate, type AuditEntry } from "../../lib/audit";
import { ACCESS_LABELS, isAccessLevel } from "../../lib/access";

const when = (at: string) => `${at.slice(0, 16)} UTC`;

export default function AuditClient({ entries, names, loadError }: { entries: AuditEntry[]; names: Record<string, string>; loadError: boolean }) {
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);

  const actorName = (id: string) => (id ? names[id] ?? "Removed user" : "System");
  const filtered = useMemo(() => filterAudit(entries, { entity, q }, (id) => (id ? names[id] ?? "Removed user" : "System")), [entries, entity, q, names]);
  const view = paginate(filtered, page, size);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Audit log</h1>
          <p className="page-subtitle">Who changed what, newest first. Read-only; showing the latest {entries.length} entries.</p>
        </div>
      </header>

      {loadError && <div className="alert alert-danger" role="alert"><AlertIcon /> The audit log couldn&apos;t be loaded right now. Please refresh. If it keeps happening, contact an administrator.</div>}

      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Search the audit log</span>
          <input className="input" type="search" placeholder="Search summary or person" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </label>
        <div role="group" aria-label="Filter by area" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["", "All"], ...AUDIT_ENTITIES.map((e) => [e, AUDIT_ENTITY_LABELS[e]])].map(([value, label]) => (
            <button key={value} type="button" className="filter-pill" aria-pressed={entity === value} onClick={() => { setEntity(value); setPage(1); }}>{label}</button>
          ))}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{filtered.length} entries</p>

      <div className="table-card">
        {view.total === 0 ? (
          <div className="empty-state"><p>{entries.length === 0 ? "Nothing has been recorded yet." : "No entries match your filters."}</p></div>
        ) : (
          <table className="data-table card-table">
            <thead>
              <tr><th scope="col">When</th><th scope="col">Person</th><th scope="col">Area</th><th scope="col">What happened</th></tr>
            </thead>
            <tbody>
              {view.rows.map((e) => (
                <tr key={e.id}>
                  <td data-label="When">{when(e.at)}</td>
                  <td data-label="Person">
                    {actorName(e.actorId)}
                    {isAccessLevel(e.actorLevel) && <span className="badge" style={{ marginLeft: 8 }}>{ACCESS_LABELS[e.actorLevel].label}</span>}
                  </td>
                  <td data-label="Area"><span className="badge">{AUDIT_ENTITY_LABELS[e.entity]} · {e.action}</span></td>
                  <td data-label="What happened">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {view.total > 0 && <Pagination page={view.page} size={size} total={view.total} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />}
    </div>
  );
}
