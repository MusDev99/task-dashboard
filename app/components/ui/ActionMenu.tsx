"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MoreIcon } from "./Icons";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  separatorBefore?: boolean;
  disabled?: boolean;
}

const MENU_WIDTH = 200;
const ITEM_HEIGHT = 40;

/** Kebab menu rendered in a portal with fixed positioning, so scroll containers can't clip it. */
export default function ActionMenu({ label, items, trigger }: { label: string; items: MenuItem[]; trigger?: ReactNode }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const open = pos !== null;
  const close = () => setPos(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) return close();
    const r = button.current!.getBoundingClientRect();
    const height = items.length * ITEM_HEIGHT + 16;
    const below = r.bottom + 4 + height <= window.innerHeight - 8;
    setPos({
      top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - height),
      left: Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    });
  };

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus();
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        button.current?.focus();
      }
    };
    // Position is computed once, so close when anything scrolls or resizes.
    const dismiss = () => close();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = Array.from(menu.current!.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])"));
    const i = els.indexOf(document.activeElement as HTMLElement);
    els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
  };

  return (
    <div className="menu-wrap" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button ref={button} type="button" className="icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={toggle} draggable={false}>
        {trigger ?? <MoreIcon />}
      </button>
      {pos &&
        createPortal(
          <div ref={menu} className="menu" role="menu" aria-label={label} style={{ position: "fixed", top: pos.top, left: pos.left, right: "auto", width: MENU_WIDTH, zIndex: 80 }} onKeyDown={onMenuKey}>
            {items.map((it) => (
              <Fragment key={it.label}>
                {it.separatorBefore && <div className="menu-sep" />}
                {it.href ? (
                  <Link role="menuitem" className={`menu-item ${it.danger ? "danger" : ""}`} href={it.href} onClick={close}>{it.icon}{it.label}</Link>
                ) : (
                  <button role="menuitem" type="button" disabled={it.disabled} className={`menu-item ${it.danger ? "danger" : ""}`} onClick={() => { close(); it.onSelect?.(); }}>
                    {it.icon}{it.label}
                  </button>
                )}
              </Fragment>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
