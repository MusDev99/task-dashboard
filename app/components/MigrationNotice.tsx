import { readTable } from "../../lib/store";
import { isAuthed } from "../../lib/auth";

/** Shown app-wide while the users table predates Settings (`stationCode`) or access levels (no `access` column). */
export default async function MigrationNotice() {
  if (!(await isAuthed())) return null; // never read the data store for signed-out visitors (e.g. on /login)
  let legacy = false;
  let noAccess = false;
  try {
    const rows = await readTable("users");
    const cols = rows.length ? Object.keys(rows[0]) : [];
    legacy = cols.includes("stationCode") && !cols.includes("locationId");
    noAccess = cols.length > 0 && !cols.includes("access");
  } catch {
    return null; // connection problems are reported by each page
  }
  if (!legacy && noAccess) {
    return (
      <div className="alert alert-danger" role="alert" style={{ maxWidth: 1400, margin: "0 auto 1rem" }}>
        Access levels aren&apos;t set up yet, so everyone can change everything. Run <code>npm run migrate:settings</code> once
        (everyone starts as Admin), then set each person&apos;s level on Users.
      </div>
    );
  }
  if (!legacy) return null;
  return (
    <div className="alert alert-danger" role="alert" style={{ maxWidth: 1400, margin: "0 auto 1rem" }}>
      The data still uses station codes. Run <code>npm run migrate:settings</code> once to move them to Locations
      (a backup of the users table is made first).
    </div>
  );
}
