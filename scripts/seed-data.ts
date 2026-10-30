// One-off seed: copies json/users.json into the "users" table
// (created if missing, OVERWRITTEN if it exists).
//
//   node --env-file=.env scripts/seed-data.ts
import { readFileSync } from "node:fs";
import { writeTable, type Cell } from "../lib/store.ts";
import { USER_COLUMNS } from "../lib/schema.ts";
import { ensureLocations } from "./seed-helpers.ts";

const load = (name: string): Record<string, Cell>[] =>
  JSON.parse(readFileSync(new URL(`../json/${name}.json`, import.meta.url), "utf-8"));

const toRows = (columns: readonly string[], items: Record<string, Cell>[]) =>
  items.map((item) => columns.map((c) => item[c] ?? null));

// Seed data still uses stationCode; link each user to a location (created if needed).
const { map: locationIds } = await ensureLocations(load("users").map((u) => String(u.stationCode ?? "")));
const users = load("users").map((u) => ({ ...u, locationId: locationIds.get(String(u.stationCode ?? "").trim().toUpperCase()) ?? null }));

await writeTable("users", [...USER_COLUMNS], toRows(USER_COLUMNS, users));
console.log(`users: wrote ${users.length} rows`);
