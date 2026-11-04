"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type RefObject } from "react";
import { logout } from "../../lib/auth-actions";
import { getUnreadCount } from "../../lib/notification-actions";
import Avatar from "./ui/Avatar";
import { useFocusTrap } from "./ui/useFocusTrap";
import { CloseIcon } from "./ui/Icons";
import { displayName } from "../lib/ui";
import { can, type AccessLevel, type Capability } from "../../lib/access";

interface SidebarUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  access: AccessLevel | null;
}

type Tone = "indigo" | "violet" | "pink" | "amber" | "emerald" | "neutral";

const navItems: { label: string; tone: Tone; href: string; tab?: boolean; cap?: Capability; icon: React.ReactNode }[] = [
  {
    label: "My schedule",
    tone: "indigo",
    tab: true,
    href: "/me",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
      </svg>
    ),
  },
  {
    label: "Dashboard",
    tone: "violet",
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
    tone: "amber",
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
    tone: "indigo",
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
    tone: "pink",
    tab: true,
    cap: "users.view",
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
    tone: "violet",
    // Not in the bottom bar (max 5 tabs on phones); reachable from the menu.
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
    label: "Leave",
    tone: "emerald",
    href: "/leave",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8c-4 0-9 3-9 9 0 0 4-1 7-4s4-5 2-5Z" />
        <path d="M8 17c0-3 1-6 4-8" />
        <circle cx="18" cy="5" r="2" />
      </svg>
    ),
  },
  {
    label: "Notifications",
    tone: "pink",
    href: "/notifications",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    label: "Settings",
    tone: "neutral",
    cap: "settings.view",
    href: "/settings",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    label: "Audit log",
    tone: "neutral",
    cap: "audit.view",
    href: "/audit",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
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

  // Unread badge: fetched on load and navigation, when the tab regains focus, and every minute. The inbox page
  // tells us right away when it changes something ("notifications:changed").
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (pathname.startsWith("/login")) return;
    let live = true;
    const refresh = () => getUnreadCount().then((n) => live && setUnread(n)).catch(() => undefined);
    const onChanged = (e: Event) => {
      const n = (e as CustomEvent<number | undefined>).detail;
      if (typeof n === "number") setUnread(n);
      else refresh();
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("notifications:changed", onChanged);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("notifications:changed", onChanged);
    };
  }, [pathname]);
  const badge = unread > 99 ? "99+" : String(unread);

  // Close the drawer on navigation.
  useEffect(() => setOpen(false), [pathname]);

  // Prevent body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (pathname.startsWith("/login")) return null; // signed-out screen has no navigation

  // Hide routes the viewer can't open (UX only; pages and actions check again). No user = auth bypassed (dev).
  const items = navItems.filter((i) => !i.cap || !user || (user.access !== null && can(user.access, i.cap)));
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
        <span className="brand-name">Work<span>Force</span></span>
        <Link href="/notifications" className="topbar-bell" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {unread > 0 && <span className="nav-badge" aria-hidden="true">{badge}</span>}
        </Link>
      </header>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      {open && <DrawerTrap target={aside} onClose={() => setOpen(false)} />}

      <aside id="app-sidebar" ref={aside} className={`sidebar ${open ? "is-open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">⚡</span>
          <div>
            <div className="brand-name">Work<span>Force</span></div>
            <div className="brand-tagline">Resource &amp; task planning</div>
          </div>
          <button type="button" className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <CloseIcon size={22} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">Menu</div>
          <ul>
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} className={`sidebar-link tone-${item.tone} ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
                    <span className="sidebar-link-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.href === "/notifications" && unread > 0 && <span className="nav-badge" aria-label={`${unread} unread`}>{badge}</span>}
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
        {items.filter((i) => i.tab).map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href} className={`bottom-nav-link tone-${item.tone} ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
              <span className="bottom-nav-icon">{item.icon}</span>
              <span>{item.label === "Dashboard" ? "Home" : item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
