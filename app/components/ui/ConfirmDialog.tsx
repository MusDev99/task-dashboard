"use client";

import { useRef, type ReactNode } from "react";
import { useFocusTrap } from "./useFocusTrap";

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, children, confirmLabel, danger, pending, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onCancel);
  return (
    <>
      <div className="overlay" style={{ zIndex: 110 }} onClick={pending ? undefined : onCancel} />
      <div ref={ref} className="modal" style={{ zIndex: 120 }} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-body">{children}</p>
        <div className="modal-actions">
          {/* Cancel gets initial focus: the safe choice is the default for destructive dialogs. */}
          <button type="button" className="btn" autoFocus onClick={onCancel} disabled={pending}>Cancel</button>
          <button type="button" className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={pending}>
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
