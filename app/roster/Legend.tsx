"use client";

import { useRef, useState } from "react";
import { useDismiss } from "../components/ui/useDismiss";
import CodeChip from "./CodeChip";
import type { ShiftCode } from "../../lib/shifts";

export default function Legend({ codes }: { codes: ShiftCode[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="legend-dots" style={{ display: "inline-flex" }} aria-hidden="true">
          {codes.map((c) => <span key={c.code} style={{ width: 10, height: 10, borderRadius: 99, background: c.color, marginRight: -2, border: "1px solid var(--bg-secondary)" }} />)}
        </span>
        Legend
      </button>
      {open && (
        <div className="menu" style={{ left: 0, right: "auto", width: 260 }}>
          {codes.map((c) => (
            <div key={c.code} className="picker-item" style={{ cursor: "default" }}>
              <CodeChip def={c} code={c.code} />
              <span className="picker-label">{c.label}</span>
              <span className="picker-meta">{c.hours ? `${c.hours}h` : "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
