# Feature: Audit log + tasks export + lint repair

**Status:** 🔨 building (verified locally; browser pass needs data-store credentials) · **Branch:** `ccr-62221fdb-cy33y0`

## 1. 🧠 Brainstorm
**Problem** — access levels now let several people change shared data; nobody can see who changed a roster day, task or access level.

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. Append-only `audit_log` table + admin page | Simple, fits the data rules, no new dependency | Reads the whole tab (capped to newest 500 for display) | S | ✅ |
| B. Per-row "updatedBy" columns | No new table | Loses history; schema migration on every table | M | |
| C. Server logs only | Zero work | Not visible to admins, not durable | S | |

**Decision:** A. Best effort recording (never fails the user's change), admin-only viewing.

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk | Status |
|---|---|---|---|---|
| 1 | `audit_log` schema, pure rules + tests, recorder | S | low | ✅ |
| 2 | Hook every write action; `/audit` page, nav | S | low | ✅ |
| 3 | Tasks CSV export | S | low | ✅ |
| 4 | ESLint flat config, lint in `verify` | S | low | ✅ |

## 3. 🔬 Feature analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Any write action succeeds → one entry (actor, level, area, action, summary) is appended | manual |
| AC-2 | Logging fails → the action still succeeds; error only in server log | manual |
| AC-3 | Only `admin` can open `/audit`; others see *no access* | unit (`audit.view` matrix) + manual |
| AC-4 | Entries unknown action/entity are never rendered | unit |
| AC-5 | Summaries are one line, no control chars, ≤ 240 chars | unit |
| AC-6 | Filter by area and text; newest first; pagination clamps | unit |
| AC-7 | Tasks export has parent code, status labels, formula-safe cells, honours filters | unit + manual |

**Data impact:** new lazily created tab `audit_log` (`lib/schema.ts` `AUDIT_COLUMNS`); no migration; rollback = ignore/delete the tab.
**OWASP:** A01 page + capability gate (`audit.view`), no write endpoint exposed; A03 summaries cleaned, rendered as text (React escapes); A09 failures logged server-side, no payloads/secrets in summaries.
**Laws of UX:** Hick (area pills only), Jakob (table + pagination + search), Miller (10/20/50 per page), Doherty (client-side filtering, skeleton `loading.tsx`). 375px: `data-table` collapses to cards via `data-label`.

## 5–6. Verify / validate
`npm run verify` (tsc + eslint + tests + build) green. Browser pass at 375px/desktop, empty and error states: ⬜ pending (needs data-store credentials in the environment).
