import { loadAuditLog, loadUsers } from "../../lib/actions";
import { viewer, viewerCan } from "../../lib/auth";
import NoAccess from "../components/NoAccess";
import AuditClient from "./AuditClient";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log · WorkForce Management" };

export default async function AuditPage() {
  const me = await viewer();
  if (!viewerCan(me, "audit.view")) return <NoAccess what="the audit log" />;
  const [{ entries, error }, { users }] = await Promise.all([loadAuditLog(), loadUsers()]);
  const names: Record<string, string> = Object.fromEntries(users.map((u) => [u.id, u.name]));
  return <AuditClient entries={entries} names={names} loadError={error} />;
}
