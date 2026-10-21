"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "../components/ui/useFocusTrap";
import CodeChip from "./CodeChip";
import type { ShiftCode } from "../../lib/shifts";

interface Props {
  anchor: DOMRect;
  title: string;
  subtitle: string;
  codes: ShiftCode[];
  onPick: (code: string | null) => void;
  onClose: () => void;
}

export default function CellPicker({ anchor, title, subtitle, codes, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onClose);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);

  const width = 290;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - 400));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(ref.current!.querySelectorAll<HTMLElement>("button"));
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  const shifts = codes.filter((c) => c.type === "shift");
  const leave = codes.filter((c) => c.type === "leave");
  const row = (c: ShiftCode) => (
    <button key={c.code} type="button" role="menuitem" className="picker-item" onClick={() => onPick(c.code)}>
      <CodeChip def={c} code={c.code} />
      <span className="picker-label">{c.label}</span>
      {c.start && <span className="picker-meta">{c.start}–{c.end}</span>}
    </button>
  );

  return (
    <>
      <div className="overlay" style={{ background: "transparent", backdropFilter: "none", zIndex: 95 }} onClick={onClose} />
      <div ref={ref} className="picker" role="menu" aria-label={`Set availability: ${title}`} style={{ left, top, width }} onKeyDown={onKey}>
        <div className="picker-head">
          <b>{title}</b>
          <span>{subtitle}</span>
        </div>
        {shifts.length > 0 && <div className="picker-group">Work shift</div>}
        {shifts.map(row)}
        {leave.length > 0 && <div className="picker-group">Leave</div>}
        {leave.map(row)}
        <div className="menu-sep" />
        <button type="button" role="menuitem" className="picker-item danger" onClick={() => onPick(null)}>
          Clear
        </button>
      </div>
    </>
  );
}
