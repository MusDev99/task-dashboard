"use client";

import { ChevronLeft, ChevronRight } from "./Icons";

export const PAGE_SIZES = [10, 20, 50];

/** 1 … 4 5 6 … 12 */
function windowed(page: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1].filter((n) => n >= 1 && n <= count));
  const sorted = [...set].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? ["gap" as const, n] : [n]));
}

interface Props {
  page: number;
  size: number;
  total: number;
  onPage: (p: number) => void;
  onSize: (s: number) => void;
}

export default function Pagination({ page, size, total, onPage, onSize }: Props) {
  const count = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <nav className="pagination" aria-label="Pagination">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <span aria-live="polite">Showing <b style={{ color: "var(--text-primary)" }}>{from}–{to}</b> of <b style={{ color: "var(--text-primary)" }}>{total}</b></span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="sr-only">Rows per page</span>
          <select className="select" style={{ minHeight: 34 }} value={size} onChange={(e) => onSize(Number(e.target.value))}>
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
          </select>
        </label>
      </div>
      <div className="pagination-pages">
        <button className="page-btn" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
        {windowed(page, count).map((n, i) =>
          n === "gap" ? (
            <span key={`g${i}`} style={{ padding: "0 4px", color: "var(--text-muted)" }}>…</span>
          ) : (
            <button key={n} className="page-btn" aria-current={n === page ? "page" : undefined} aria-label={`Page ${n}`} onClick={() => onPage(n)}>{n}</button>
          )
        )}
        <button className="page-btn" onClick={() => onPage(page + 1)} disabled={page >= count} aria-label="Next page"><ChevronRight size={16} /></button>
      </div>
    </nav>
  );
}
