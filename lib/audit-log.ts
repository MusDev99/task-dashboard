import { appendRow, ensureTab } from "./store";
import { AUDIT_COLUMNS } from "./schema";
import { buildAuditEntry, type AuditInput } from "./audit";
import type { Actor } from "./auth";

/**
 * Records who changed what. Best effort by design: the change has already been saved, so a failure here is
 * logged server-side and never turns a successful action into an error for the person.
 */
export async function recordAudit(actor: Actor, input: AuditInput): Promise<void> {
  try {
    await ensureTab("audit_log", AUDIT_COLUMNS);
    await appendRow("audit_log", AUDIT_COLUMNS, { ...buildAuditEntry(actor, input, new Date(), crypto.randomUUID()) });
  } catch (e) {
    console.error("audit log write failed", e);
  }
}
