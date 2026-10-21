import { readTable } from "../../lib/googleSheets";

/** Shown app-wide while the users tab still has the pre-Settings `stationCode` column. */
export default async function MigrationNotice() {
  let legacy = false;
  try {
    const rows = await readTable("users");
    const cols = rows.length ? Object.keys(rows[0]) : [];
    legacy = cols.includes("stationCode") && !cols.includes("locationId");
  } catch {
    return null; // connection problems are reported by each page
  }
  if (!legacy) return null;
  return (
    <div className="alert alert-danger" role="alert" style={{ maxWidth: 1400, margin: "0 auto 1rem" }}>
      The Google Sheet still uses station codes. Run <code>npm run migrate:settings</code> once to move them to Locations
      (a backup of the users tab is made first).
    </div>
  );
}
