import { loadNotifications } from "../../lib/actions";
import { viewer } from "../../lib/auth";
import NoAccess from "../components/NoAccess";
import NotificationsClient from "./NotificationsClient";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications · WorkForce Management" };

export default async function NotificationsPage() {
  const me = await viewer();
  if (!me) return <NoAccess what="notifications" />;
  // Only ever the signed-in person's own notifications (auth bypass has no person, so an empty inbox).
  const { notifications, error } = me.uid ? await loadNotifications(me.uid) : { notifications: [], error: false };
  return <NotificationsClient items={notifications} loadError={error} signedIn={!!me.uid} />;
}
