"use client";

import { useRef, useState } from "react";
import { useDismiss } from "../components/ui/useDismiss";
import type { Resource } from "./types";

interface Props {
  resources: Resource[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export default function ResourcePicker({ resources, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const all = selected.size === resources.length;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    onChange(next);
  };

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {all ? `All resources (${resources.length})` : `${selected.size} of ${resources.length} resources`}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="menu" style={{ left: 0, right: "auto", width: 280, maxHeight: 340, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 6, padding: "2px 4px 6px" }}>
            <button type="button" className="btn" style={{ minHeight: 32, padding: "0 10px", fontSize: "0.75rem" }} onClick={() => onChange(new Set(resources.map((r) => r.id)))}>Select all</button>
            <button type="button" className="btn" style={{ minHeight: 32, padding: "0 10px", fontSize: "0.75rem" }} onClick={() => onChange(new Set())}>None</button>
          </div>
          {resources.map((r) => (
            <label key={r.id} className="menu-item" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name.replace(/\s-\s*$/, "")}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
