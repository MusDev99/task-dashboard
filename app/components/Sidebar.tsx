"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { logout } from "../../lib/auth-actions";
import Avatar from "./ui/Avatar";
import { useFocusTrap } from "./ui/useFocusTrap";
import { CloseIcon } from "./ui/Icons";
import { displayName } from "../lib/ui";

interface SidebarUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

const navItems: { label: string; href: string; tab?: boolean; icon: React.ReactNode }[] = [
  {
    label: "Dashboard",
    tab: true,
    href: "/",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: "Tasks",
    tab: true,
    href: "/tasks",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="18" rx="1.5" />
        <rect x="14" y="3" width="7" height="11" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Roster",
    tab: true,
    href: "/roster",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: "Users",
    tab: true,
    href: "/users",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Teams",
    tab: true,
    href: "/teams",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="6" r="3" />
        <circle cx="5" cy="15" r="2.5" />
        <circle cx="19" cy="15" r="2.5" />
        <path d="M8.5 20.5a3.5 3.5 0 0 1 7 0" />
        <path d="M12 9v3M7 13.5 10 12M17 13.5 14 12" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

/** Mounted only while the mobile drawer is open: traps Tab, closes on Esc, returns focus on close. */
function DrawerTrap({ target, onClose }: { target: RefObject<HTMLElement | null>; onClose: () => void }) {
  useFocusTrap(target, onClose);
  useEffect(() => {
    target.current?.querySelector<HTMLElement>("a,button")?.focus();
  }, [target]);
  return null;
}

// Layout is CSS-driven (media queries), so the server HTML is already correct on phones:
// no JS width check, no hydration flash, no layout shift. Desktop = sticky sidebar; mobile =
// top bar + off-canvas drawer + thumb-reachable bottom tab bar.
export default function Sidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const aside = useRef<HTMLElement>(null);

  // Close the drawer on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // Prevent body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (pathname.startsWith("/login")) return null; // signed-out screen has no navigation

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <>
      <header className="mobile-topbar">
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="app-sidebar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="brand-mark brand-mark-sm" aria-hidden="true">⚡</span>
        <span className="brand-name">WorkForce</span>
      </header>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      {open && <DrawerTrap target={aside} onClose={() => setOpen(false)} />}

      <aside id="app-sidebar" ref={aside} className={`sidebar ${open ? "is-open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">⚡</span>
          <div>
            <div className="brand-name">WorkForce</div>
            <div className="brand-tagline">Resource &amp; task planning</div>
          </div>
          <button type="button" className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <CloseIcon size={22} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">Menu</div>
          <ul>
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={`sidebar-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
                    <span className="sidebar-link-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-foot">
          {user && (
            <div className="sidebar-user">
              <Avatar id={user.id} name={user.name} src={user.avatar} size="sm" />
              <div style={{ minWidth: 0 }}>
                <div className="sidebar-user-name">{displayName(user.name)}</div>
                <div className="sidebar-user-email">{user.email}</div>
              </div>
            </div>
          )}
          {user && (
            <form action={logout} style={{ marginTop: "0.75rem" }}>
              <button type="submit" className="btn sidebar-signout">Sign out</button>
            </form>
          )}
        </div>
      </aside>

      <nav className="bottom-nav" aria-label="Quick navigation">
        {navItems.filter((i) => i.tab).map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} className={`bottom-nav-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
              {item.icon}
              <span>{item.label === "Dashboard" ? "Home" : item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
