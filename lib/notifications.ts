// Notification rules (pure, no data access): who is told, how a row is shaped, what is unread, what can be pruned.
// No runtime imports on purpose: tests run this file directly with `node --test`.

export const NOTIFICATION_KINDS = ["leave_requested", "leave_decided", "task_assigned"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface Notification {
  id: string;
  userId: string; // the recipient
  kind: NotificationKind;
  title: string;
  body: string;
  href: string; // an internal path, e.g. /leave
  createdAt: string; // YYYY-MM-DD HH:mm:ss.SSS (UTC)
  readAt: string; // empty = unread
}

export interface NotifyInput {
  kind: NotificationKind;
  title: string;
  body?: string;
  href: string;
}

export const TITLE_MAX = 120;
export const BODY_MAX = 240;
export const KEEP_READ_DAYS = 30;
export const MAX_PER_USER = 200;

export const isNotificationKind = (v: unknown): v is NotificationKind => (NOTIFICATION_KINDS as readonly string[]).includes(String(v));

/** One line, no control characters, capped (same rule as the audit log summary). */
export function cleanLine(raw: unknown, max: number): string {
  const s = String(raw ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Only in-app paths are followed ("/leave", "/tasks?x=1"); anything else (other sites, "//host", "javascript:") becomes the inbox. */
export function safeInternalPath(href: unknown): string {
  const s = typeof href === "string" ? href.trim() : "";
  return /^\/(?![/\\])[A-Za-z0-9\-._~/?=&%#]*$/.test(s) ? s : "/notifications";
}

const stampOf = (d: Date) => d.toISOString().replace("T", " ").replace("Z", "");

/**
 * One row per distinct recipient. The person who caused the event is never told about their own action,
 * and blank ids are dropped.
 */
export function buildNotifications(recipientIds: Iterable<string>, input: NotifyInput, actorId: string, now: Date, newId: () => string): Notification[] {
  const seen = new Set<string>();
  const out: Notification[] = [];
  for (const raw of recipientIds) {
    const userId = String(raw ?? "").trim();
    if (!userId || userId === actorId || seen.has(userId)) continue;
    seen.add(userId);
    out.push({
      id: newId(), userId, kind: input.kind, title: cleanLine(input.title, TITLE_MAX), body: cleanLine(input.body ?? "", BODY_MAX),
      href: safeInternalPath(input.href), createdAt: stampOf(now), readAt: "",
    });
  }
  return out;
}

/** Stored rows → notifications for one person; rows with an unknown kind are skipped, newest first. */
export function parseNotifications(rows: readonly Record<string, unknown>[], userId: string): Notification[] {
  const t = (v: unknown) => (v == null ? "" : String(v));
  const out: Notification[] = [];
  for (const r of rows) {
    if (t(r.userId) !== userId || !isNotificationKind(r.kind)) continue;
    out.push({
      id: t(r.id), userId, kind: r.kind as NotificationKind, title: cleanLine(r.title, TITLE_MAX), body: cleanLine(r.body, BODY_MAX),
      href: safeInternalPath(r.href), createdAt: t(r.createdAt), readAt: t(r.readAt),
    });
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export const isUnread = (n: { readAt: string }) => !n.readAt;
export const unreadCount = (list: readonly { readAt: string }[]) => list.filter(isUnread).length;

/**
 * Who should hear about a new leave request: every active admin and planner, plus the lead of each team the
 * requester belongs to. Never the requester.
 */
export function leaveApprovers(
  requesterId: string,
  users: readonly { id: string; access: string; isActive: boolean }[],
  teams: readonly { id: string; leadId: string | null }[],
  members: readonly { teamId: string; userId: string }[],
): string[] {
  const active = new Map(users.filter((u) => u.isActive).map((u) => [u.id, u]));
  const out = new Set<string>();
  for (const u of active.values()) if (u.access === "admin" || u.access === "planner") out.add(u.id);
  const mine = new Set(members.filter((m) => m.userId === requesterId).map((m) => m.teamId));
  for (const t of teams) if (mine.has(t.id) && t.leadId && active.has(t.leadId)) out.add(t.leadId);
  out.delete(requesterId);
  return [...out];
}

/**
 * Ids to delete from one person's notifications: read ones older than KEEP_READ_DAYS, and the oldest beyond
 * MAX_PER_USER. Unread notifications within the cap are never removed.
 */
export function pruneIds(list: readonly Notification[], now: Date, keepReadDays = KEEP_READ_DAYS, maxPerUser = MAX_PER_USER): string[] {
  const cutoff = stampOf(new Date(now.getTime() - keepReadDays * 86_400_000));
  const drop = new Set(list.filter((n) => n.readAt && n.createdAt < cutoff).map((n) => n.id));
  const newestFirst = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  newestFirst.slice(maxPerUser).forEach((n) => drop.add(n.id));
  return [...drop];
}
