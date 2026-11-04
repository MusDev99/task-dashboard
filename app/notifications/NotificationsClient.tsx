"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllRead, markRead } from "../../lib/notification-actions";
import { safeInternalPath, unreadCount, type Notification } from "../../lib/notifications";
import Pagination from "../components/ui/Pagination";
import ToastRegion from "../components/ui/Toast";
import { useToasts } from "../components/ui/useToasts";
import { AlertIcon } from "../components/ui/Icons";

const when = (at: string) => {
  const t = Date.parse(`${at.replace(" ", "T")}Z`);
  if (!Number.isFinite(t)) return "";
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

const tell = (unread: number) => window.dispatchEvent(new CustomEvent("notifications:changed", { detail: unread }));

export default function NotificationsClient({ items, loadError, signedIn }: { items: Notification[]; loadError: boolean; signedIn: boolean }) {
  const router = useRouter();
  const { toasts, notify } = useToasts();
  const [readNow, setReadNow] = useState<Set<string>>(new Set()); // marked read on this page, before the server round-trip returns
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [pending, start] = useTransition();

  const list = useMemo(() => items.map((n) => (readNow.has(n.id) && !n.readAt ? { ...n, readAt: "now" } : n)), [items, readNow]);
  const unread = unreadCount(list);
  const pages = Math.max(1, Math.ceil(list.length / size));
  const safePage = Math.min(page, pages);
  const visible = list.slice((safePage - 1) * size, safePage * size);

  const open = (n: Notification) => {
    if (!n.readAt && !readNow.has(n.id)) {
      setReadNow((s) => new Set(s).add(n.id));
      tell(Math.max(0, unread - 1));
      void markRead([n.id]);
    }
    router.push(safeInternalPath(n.href));
  };
  const readAll = () =>
    start(async () => {
      setReadNow(new Set(items.map((n) => n.id)));
      const res = await markAllRead();
      if (res.ok) {
        tell(0);
        notify("success", "All caught up");
        router.refresh();
      } else {
        setReadNow(new Set());
        notify("error", res.message);
      }
    });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Leave requests and decisions, and tasks assigned to you.</p>
        </div>
        {unread > 0 && <button type="button" className="btn" onClick={readAll} disabled={pending}>{pending ? "Working…" : `Mark all as read (${unread})`}</button>}
      </div>

      {loadError && <div className="alert alert-danger" role="alert"><AlertIcon /> Couldn&apos;t load notifications. Please refresh. If it keeps happening, contact an administrator.</div>}
      {!signedIn && <div className="alert alert-info" role="status">Notifications belong to a signed-in person, so this session has none.</div>}
      <p className="sr-only" aria-live="polite">{unread} unread</p>

      <div className="table-card">
        {list.length === 0 ? (
          <div className="empty-state">
            <h3>Nothing here yet</h3>
            <p>You&apos;ll be told when someone asks for leave, your request is decided, or a task is assigned to you.</p>
          </div>
        ) : (
          <ul className="inbox" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {visible.map((n) => (
              <li key={n.id}>
                <button type="button" className={`inbox-item ${n.readAt ? "" : "is-unread"}`} onClick={() => open(n)}>
                  <span className="inbox-dot" aria-hidden="true" />
                  <span>
                    <span className="inbox-title">{!n.readAt && <span className="sr-only">Unread: </span>}{n.title}</span>
                    {n.body && <span className="inbox-body">{n.body}</span>}
                  </span>
                  <span className="inbox-time" suppressHydrationWarning>{!n.readAt && <b className="badge badge-indigo" style={{ marginRight: 6 }}>New</b>}{when(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {list.length > 0 && <Pagination page={safePage} size={size} total={list.length} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />}
      <ToastRegion toasts={toasts} />
    </div>
  );
}
