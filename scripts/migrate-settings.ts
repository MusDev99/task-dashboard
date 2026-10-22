// One-time (idempotent) migration to Operational Settings:
//  1. seeds roster_codes / task_statuses / story_points / app_settings from json/ if missing
//  2. backs up the users tab, then replaces users.stationCode with users.locationId
//     (creating a location per distinct station code)
//  3. creates a role for every roleId in use
//
//   node --env-file=.env scripts/migrate-settings.ts
import { readTable, writeTable, type Cell } from "../lib/store.ts";
import { ensureLocations, ensureRoles, seedDefaults } from "./seed-helpers.ts";

const seeded = await seedDefaults();
console.log(seeded.length ? `Seeded: ${seeded.join(", ")}` : "Settings tabs already present (not changed)");

const users = await readTable("users");
const header = users.length ? Object.keys(users[0]) : [];

if (header.includes("stationCode") && !header.includes("locationId")) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const backup = `users_backup_${stamp}`;
  await writeTable(backup, header, users.map((u) => header.map((h) => u[h] ?? "")));
  console.log(`Backed up ${users.length} users to tab "${backup}"`);

  const { map, created } = await ensureLocations(users.map((u) => String(u.stationCode ?? "")));
  console.log(`Locations: ${created} created`);

  const next = header.map((h) => (h === "stationCode" ? "locationId" : h));
  const rows: Cell[][] = users.map((u) =>
    next.map((h) => (h === "locationId" ? map.get(String(u.stationCode ?? "").trim().toUpperCase()) ?? "" : u[h] ?? ""))
  );
  await writeTable("users", next, rows);
  const linked = rows.filter((r) => r[next.indexOf("locationId")]).length;
  console.log(`Users: stationCode → locationId (${linked}/${users.length} linked to a location)`);
} else if (header.includes("locationId")) {
  console.log("Users already use locationId (not changed)");
} else {
  console.log("Users tab has no stationCode/locationId column; nothing to migrate");
}

const rolesCreated = await ensureRoles(users.map((u) => String(u.roleId ?? "")));
console.log(`Roles: ${rolesCreated} created`);
