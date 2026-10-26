import Link from "next/link";
import { getUserById } from "../../../lib/actions";
import { getLocations, getRoles } from "../../../lib/settings";
import Avatar from "../../components/ui/Avatar";
import { displayName } from "../../lib/ui";

// Data is read fresh on every request.
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ userId: string }>;
}

const fmtDate = (s: string) => {
  const d = new Date(s.replace(" ", "T") + (s.includes("Z") ? "" : "Z"));
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

export default async function UserProfilePage({ params }: Props) {
  const { userId } = await params;
  const [user, locations, roles] = await Promise.all([getUserById(userId), getLocations(), getRoles()]);

  if (!user) {
    return (
      <div className="page empty-state">
        <h1 className="page-title">User not found</h1>
        <Link href="/users" className="btn">← Back to Users</Link>
      </div>
    );
  }

  const location = locations.find((l) => l.id === user.locationId);
  const role = roles.find((r) => r.id === user.roleId);
  const details: [string, string][] = [
    ["Email", user.email],
    ["Phone", user.phoneNumber ?? "—"],
    ["Employee ID", user.employeeId ?? "—"],
    ["Location", location?.name ?? "—"],
    ["Role", role?.name ?? "—"],
    ["Joined", fmtDate(user.joinedDate)],
  ];

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <Link href="/users" className="back-link">← Back to Users</Link>

      <div className="table-card profile-header">
        <Avatar id={user.id} name={user.name} src={user.avatar} size="lg" />
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title" style={{ marginBottom: 6 }}>{displayName(user.name)}</h1>
          <span className={`status ${user.isActive ? "status-active" : "status-inactive"}`}>{user.isActive ? "Active" : "Inactive"}</span>
        </div>
        <div className="profile-actions">
          <Link href="/roster" className="btn">Roster</Link>
          <Link href={`/tasks?assignee=${encodeURIComponent(user.id)}&view=list`} className="btn">Tasks</Link>
        </div>
      </div>

      <dl className="table-card profile-details">
        {details.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
