"use server";

import { revalidatePath } from "next/cache";
import { loadNotifications } from "./actions";
import { deleteRowsByIds, upsertRowsById } from "./store";
import { NOTIFICATION_COLUMNS } from "./schema";
import { pruneIds, unreadCount } from "./notifications";
import { requireActor } from "./auth";

export type NotificationResult = { ok: true; unread: number } | { ok: false; message: string };

const nowStamp = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const fail = (e: unknown): { ok: false; message: string } => {
  console.error(e);
  return { ok: false, message: "Couldn't update notifications. Please try again." };
};

/** The badge number. Read-only and always about the signed-in person; 0 when there is no signed-in person (dev bypass) or on any failure. */
export async function getUnreadCount(): Promise<number> {
  try {
    const actor = await requireActor();
    if (!actor.uid) return 0;
    const { notifications, error } = await loadNotifications(actor.uid);
    return error ? 0 : unreadCount(notifications);
  } catch {
    return 0;
  }
}

/** Marks some of MY notifications as read. Ids that aren't mine are ignored, never touched. */
export async function markRead(ids: string[]): Promise<NotificationResult> {
  const actor = await requireActor();
  if (!actor.uid) return { ok: false, message: "Sign in as a registered person to use notifications." };
  try {
    const wanted = new Set((Array.isArray(ids) ? ids : []).map(String).slice(0, 500));
    const { notifications, error } = await loadNotifications(actor.uid);
    if (error) throw new Error("notifications could not be loaded");
    const stamp = nowStamp();
    const rows = notifications.filter((n) => wanted.has(n.id) && !n.readAt).map((n) => ({ ...n, readAt: stamp }));
    await upsertRowsById("notifications", NOTIFICATION_COLUMNS, rows);
    revalidatePath("/notifications");
    return { ok: true, unread: unreadCount(notifications) - rows.length };
  } catch (e) {
    return fail(e);
  }
}

/** Marks all of MY notifications as read and tidies up my old ones (read for 30+ days, or beyond the newest 200). */
export async function markAllRead(): Promise<NotificationResult> {
  const actor = await requireActor();
  if (!actor.uid) return { ok: false, message: "Sign in as a registered person to use notifications." };
  try {
    const { notifications, error } = await loadNotifications(actor.uid);
    if (error) throw new Error("notifications could not be loaded");
    const stamp = nowStamp();
    await upsertRowsById("notifications", NOTIFICATION_COLUMNS, notifications.filter((n) => !n.readAt).map((n) => ({ ...n, readAt: stamp })));
    const old = pruneIds(notifications.map((n) => ({ ...n, readAt: n.readAt || stamp })), new Date());
    if (old.length) await deleteRowsByIds("notifications", old);
    revalidatePath("/notifications");
    return { ok: true, unread: 0 };
  } catch (e) {
    return fail(e);
  }
}
