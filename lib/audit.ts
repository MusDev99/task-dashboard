// Audit log rules (pure, no data access): shapes an entry, parses stored rows, filters for display.
// No runtime imports on purpose: tests run this file directly with `node --test`.

export const AUDIT_ENTITIES = ["task", "roster", "user", "team", "setting", "leave"] as const;
export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  task: "Tasks", roster: "Roster", user: "Users", team: "Teams", setting: "Settings", leave: "Leave",
};

export const AUDIT_ACTIONS = ["create", "update", "delete", "status", "bulk", "import", "access"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  id: string;
  at: string; // YYYY-MM-DD HH:mm:ss.SSS (UTC), same stored format as every other table
  actorId: string;
  actorLevel: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  summary: string;
}

export interface AuditInput {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  /** Human sentence naming what changed. Never put secrets, tokens or whole payloads here. */
  summary: string;
}

export const SUMMARY_MAX = 240;

/** One line, no control characters, capped. Keeps the log readable and its rows from carrying markup or newlines. */
export function cleanSummary(raw: unknown): string {
  const s = String(raw ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return s.length > SUMMARY_MAX ? `${s.slice(0, SUMMARY_MAX - 1)}…` : s;
}

const stampOf = (d: Date) => d.toISOString().replace("T", " ").replace("Z", "");

export function buildAuditEntry(actor: { uid: string; level: string }, input: AuditInput, now: Date, id: string): AuditEntry {
  return {
    id,
    at: stampOf(now),
    actorId: actor.uid,
    actorLevel: actor.level,
    action: input.action,
    entity: input.entity,
    entityId: String(input.entityId ?? "").trim(),
    summary: cleanSummary(input.summary),
  };
}

const isAction = (v: unknown): v is AuditAction => (AUDIT_ACTIONS as readonly string[]).includes(String(v));
const isEntity = (v: unknown): v is AuditEntity => (AUDIT_ENTITIES as readonly string[]).includes(String(v));

/** Stored row → entry; rows with an unknown action/entity are skipped (never rendered unchecked). */
export function parseAuditRows(rows: readonly Record<string, unknown>[]): AuditEntry[] {
  const out: AuditEntry[] = [];
  for (const r of rows) {
    if (!isAction(r.action) || !isEntity(r.entity)) continue;
    out.push({
      id: String(r.id ?? ""), at: String(r.at ?? ""), actorId: String(r.actorId ?? ""), actorLevel: String(r.actorLevel ?? ""),
      action: r.action as AuditAction, entity: r.entity as AuditEntity, entityId: String(r.entityId ?? ""), summary: cleanSummary(r.summary),
    });
  }
  return out;
}

export interface AuditFilter {
  entity?: string;
  q?: string;
}

/** Newest first, then filtered by entity and a case-insensitive text match on summary / actor name. */
export function filterAudit(entries: readonly AuditEntry[], filter: AuditFilter, actorName: (id: string) => string = (id) => id): AuditEntry[] {
  const q = (filter.q ?? "").trim().toLowerCase();
  const entity = isEntity(filter.entity) ? filter.entity : null;
  return [...entries]
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .filter((e) => !entity || e.entity === entity)
    .filter((e) => !q || e.summary.toLowerCase().includes(q) || actorName(e.actorId).toLowerCase().includes(q));
}

export const AUDIT_PAGE_SIZE = 25;

export function paginate<T>(items: readonly T[], page: number, size = AUDIT_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(Number(page)) || 1), pages);
  return { rows: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}
