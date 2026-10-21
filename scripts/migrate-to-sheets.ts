// One-off migration: copies json/users.json and json/tasks.json into the
// "users" and "tasks" tabs of the Google Sheet (tabs are created if missing,
// and overwritten if they exist).
//
//   node --env-file=.env scripts/migrate-to-sheets.ts
import { readFileSync } from "node:fs";
import { writeTable, type Cell } from "../lib/googleSheets.ts";
import { USER_COLUMNS, TASK_COLUMNS } from "../lib/schema.ts";
import { ensureLocations } from "./seed-helpers.ts";

const load = (name: string): Record<string, Cell>[] =>
  JSON.parse(readFileSync(new URL(`../json/${name}.json`, import.meta.url), "utf-8"));

const toRows = (columns: readonly string[], items: Record<string, Cell>[]) =>
  items.map((item) => columns.map((c) => item[c] ?? null));

// Seed data still uses stationCode; link each user to a location (created if needed).
const { map: locationIds } = await ensureLocations(load("users").map((u) => String(u.stationCode ?? "")));
const users = load("users").map((u) => ({ ...u, locationId: locationIds.get(String(u.stationCode ?? "").trim().toUpperCase()) ?? null }));
const tasks = load("tasks");

await writeTable("users", [...USER_COLUMNS], toRows(USER_COLUMNS, users));
console.log(`users: wrote ${users.length} rows`);
await writeTable("tasks", [...TASK_COLUMNS], toRows(TASK_COLUMNS, tasks));
console.log(`tasks: wrote ${tasks.length} rows`);
