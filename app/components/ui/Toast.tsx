"use client";

import { CheckIcon, AlertIcon } from "./Icons";

export interface ToastItem {
  id: number;
  kind: "success" | "error";
  text: string;
}

export default function ToastRegion({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span style={{ color: t.kind === "success" ? "var(--accent-emerald)" : "var(--danger)", display: "flex" }}>
            {t.kind === "success" ? <CheckIcon /> : <AlertIcon />}
          </span>
          {t.text}
        </div>
      ))}
    </div>
  );
}
