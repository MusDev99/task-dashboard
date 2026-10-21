"use client";

import { useMemo, useRef, useState } from "react";
import { useFocusTrap } from "../components/ui/useFocusTrap";
import type { Resource } from "./types";

interface Props {
  resources: Resource[];
  monthLabel: string;
  countFor: (userId: string) => number;
  pending: boolean;
  onConfirm: (userIds: string[]) => void;
  onCancel: () => void;
}

export default function ClearScheduleDialog({ resources, monthLabel, countFor, pending, onConfirm, onCancel }: Props) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onCancel);
  const total = useMemo(() => [...picked].reduce((n, id) => n + countFor(id), 0), [picked, countFor]);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (!n.delete(id)) n.add(id); return n; });

  return (
    <>
      <div className="overlay" style={{ zIndex: 110 }} onClick={pending ? undefined : onCancel} />
      <div ref={ref} className="modal" style={{ zIndex: 120, width: "min(480px, calc(100vw - 2rem))" }} role="dialog" aria-modal="true" aria-labelledby="cs-title">
        <h2 id="cs-title">Clear schedule</h2>
        <p>Choose the resources whose {monthLabel} schedule should be cleared.</p>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button type="button" className="btn" style={{ minHeight: 32, fontSize: "0.75rem" }} onClick={() => setPicked(new Set(resources.map((r) => r.id)))}>Select all</button>
          <button type="button" className="btn" style={{ minHeight: 32, fontSize: "0.75rem" }} onClick={() => setPicked(new Set())}>None</button>
        </div>
        <div className="checklist">
          {resources.map((r) => (
            <label key={r.id} className="checklist-row">
              <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name.replace(/\s-\s*$/, "")}</span>
              <span className="picker-meta">{countFor(r.id)} {countFor(r.id) === 1 ? "entry" : "entries"}</span>
            </label>
          ))}
        </div>
        <p style={{ margin: "1rem 0 1.25rem" }} aria-live="polite">
          {picked.size === 0 ? "Nothing selected." : <>This permanently removes <b style={{ color: "var(--text-primary)" }}>{total}</b> roster {total === 1 ? "entry" : "entries"} for {picked.size} {picked.size === 1 ? "resource" : "resources"}. This can&apos;t be undone.</>}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" autoFocus onClick={onCancel} disabled={pending}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={pending || picked.size === 0 || total === 0} onClick={() => onConfirm([...picked])}>
            {pending ? "Clearing…" : "Clear schedule"}
          </button>
        </div>
      </div>
    </>
  );
}
