import { ensureTab, upsertRowsById } from "./store";
import { NOTIFICATION_COLUMNS } from "./schema";
import { buildNotifications, type NotifyInput } from "./notifications";

/**
 * Tells people about something that just happened. Best effort by design: the change has already been saved,
 * so a failure here is logged and never turns a successful action into an error. The person who caused the
 * event is never notified about it.
 */
export async function notifyUsers(recipientIds: Iterable<string>, input: NotifyInput, actorId: string): Promise<void> {
  try {
    const rows = buildNotifications(recipientIds, input, actorId, new Date(), () => crypto.randomUUID());
    if (rows.length === 0) return;
    await ensureTab("notifications", NOTIFICATION_COLUMNS);
    await upsertRowsById("notifications", NOTIFICATION_COLUMNS, rows.map((r) => ({ ...r })));
  } catch (e) {
    console.error("notification write failed", e);
  }
}
