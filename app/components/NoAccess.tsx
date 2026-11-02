import Link from "next/link";

/** Shown instead of a page the viewer's access level can't open (the server actions refuse too). */
export default function NoAccess({ what }: { what: string }) {
  return (
    <div className="page">
      <div className="table-card">
        <div className="empty-state" role="alert">
          <h1 className="page-title">You don&apos;t have access to {what}</h1>
          <p>Your access level doesn&apos;t include this page. If you need it, ask an admin to change your access level.</p>
          <Link href="/" className="btn">Go to the dashboard</Link>
        </div>
      </div>
    </div>
  );
}
