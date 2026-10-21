import { dayLabel } from "./roster-dates";
import type { ShiftConfig, ShiftCode } from "./shifts";
import type { User } from "../app/lib/types";
import type { Location } from "./settings";
import type { Resource, RosterEntry } from "../app/roster/types";

/** Active users as roster resources (shared by the roster page and the dashboard). */
export function toResources(users: User[], locations: Location[] = []): Resource[] {
  const nameOf = new Map(locations.map((l) => [l.id, l.name]));
  return users
    .filter((u) => u.isActive)
    .map((u) => ({
      id: u.id, name: u.name, email: u.email, employeeId: u.employeeId, avatar: u.avatar,
      locationId: u.locationId, locationName: u.locationId ? nameOf.get(u.locationId) ?? null : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface Group {
  def: ShiftCode;
  people: Resource[];
}

export interface Whereabouts {
  total: number;
  working: Group[];
  leave: Group[];
  unscheduled: Resource[];
}

const byName = (a: Resource, b: Resource) => a.name.localeCompare(b.name);

/** Who is working / away / unscheduled on one day. `entries` must already be filtered to that date. */
export function buildWhereabouts(resources: Resource[], entries: RosterEntry[], config: ShiftConfig): Whereabouts {
  const byUser = new Map(entries.map((e) => [e.userId, e.code]));
  const groups = new Map<string, Resource[]>();
  const unscheduled: Resource[] = [];

  for (const r of resources) {
    const code = byUser.get(r.id);
    // A code that no longer exists in the config is treated as unscheduled rather than guessed at.
    if (code && config.codes.some((c) => c.code === code)) groups.set(code, [...(groups.get(code) ?? []), r]);
    else unscheduled.push(r);
  }

  const build = (type: ShiftCode["type"]): Group[] =>
    config.codes
      .filter((c) => c.type === type && groups.has(c.code))
      .map((def) => ({ def, people: groups.get(def.code)!.sort(byName) }));

  return { total: resources.length, working: build("shift"), leave: build("leave"), unscheduled: unscheduled.sort(byName) };
}

/** Case-insensitive match on name, employee ID, email, or the person's code (e.g. "AL"). */
export function matches(person: Resource, code: string | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [person.name, person.employeeId, person.email, code].some((v) => v?.toLowerCase().includes(q));
}

export const countPeople = (groups: Group[]) => groups.reduce((n, g) => n + g.people.length, 0);

/** Plain-text summary for pasting into a chat. */
export function buildChatText(date: string, w: Whereabouts, display: (name: string) => string): string {
  const working = countPeople(w.working);
  const away = countPeople(w.leave);
  const lines = [
    `Daily Whereabouts — ${dayLabel(date)}`,
    `Total ${w.total} · Working ${working} · On leave/off ${away} · Unscheduled ${w.unscheduled.length}`,
    "",
    `WORKING (${working})`,
  ];
  if (working === 0) lines.push("- none");
  for (const g of w.working) {
    lines.push(`${g.def.label}${g.def.start ? ` ${g.def.start}–${g.def.end}` : ""} (${g.people.length})`);
    lines.push(...g.people.map((p) => `- ${display(p.name)}`));
  }
  lines.push("", `ON LEAVE / OFF (${away})`);
  if (away === 0) lines.push("- none");
  for (const g of w.leave) {
    lines.push(`${g.def.label} [${g.def.code}] (${g.people.length})`);
    lines.push(...g.people.map((p) => `- ${display(p.name)}`));
  }
  lines.push("", `UNSCHEDULED (${w.unscheduled.length})`);
  if (w.unscheduled.length === 0) lines.push("- none");
  lines.push(...w.unscheduled.map((p) => `- ${display(p.name)}`));
  return lines.join("\n");
}
