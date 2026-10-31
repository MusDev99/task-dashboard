# Feature: Access levels (RBAC)

**Status:** 🔨 building (slice 1 done, browser pass pending)
**Owner:** Mustaqeem · **Branch:** `feat/rbac` · **Issue/PR:** — · **Target version:** 0.3.0
**Product brief:** [docs/product/briefs/rbac.md](../../product/briefs/rbac.md) (stories US-1…8, product ACs, owner decisions)

## 1. 🧠 Brainstorm
**Problem:** every signed-in user can change everything (roster, CSV import, users, settings). The 18 write actions only check that the caller is signed in. This blocks opening WM to the whole workforce.

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. Fixed levels (Admin / Planner / Lead / Member), leads scoped by the teams they lead | Simple, testable as a pure matrix, reuses Teams | Not customisable | M | ✅ |
| B. Configurable role → permission matrix in Settings | Flexible | Many combinations; easy lock-out | L | |
| C. Reuse the job `roles` list | No new column | Mixes job title with power | S | ❌ |

**Decision:** A. Owner decisions (2026-10-31):
- A lead edits the roster of anyone in a team they lead.
- Leads may edit tasks outside their teams.
- Planners see Settings read-only.

**Added for security:** leads can't add members to their team or change its lead. Otherwise a lead could widen their own roster scope.

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk | Status |
|---|---|---|---|---|
| 1 | `lib/access.ts` matrix + `requireActor`/`actorWith` on all 18 write actions, `users.access` column + migration, Access level in the Users drawer, last-admin rule | M | Med (lock-out) | ✅ code · ⬜ browser |
| 2 | Hide controls per level, nav filtering, "no access" page for `/users` and `/settings`, Settings read-only for planners | M | Low | ⬜ |
| 3 | Roster: grey out / lock rows a lead can't edit; default team filter to their teams | S | Low | ⬜ |
| 4 | Member "my tasks" status changes in the UI (server already allows it) | S | Low | ⬜ |

## 3. 🔬 Feature analysis
### 3.1 Acceptance criteria (slice 1)
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Given I'm an admin editing a user, when I pick an Access level and save, then it's stored. The toast says "Ana is now a Planner". | manual |
| AC-2 | Given a new user is added without changing the field, then they are a Member. | manual + `parseAccess` test |
| AC-4 | Given a member calls any write action directly, then it returns "You don't have permission to do that." and nothing changes. The refusal is logged with action, uid and level. | `matrix` test + code review (18/18 guarded) |
| AC-5 | Given I lead team A (x, y) and not B (z), when I save cells for x and z, then the whole batch is refused with a count, and nothing is saved. | `roster` test + manual |
| AC-9 | Given I'm the only active admin, when I demote, deactivate or delete myself, then it's refused. | `last active admin` test + manual |
| AC-10 | Given Ana is demoted, then her next action uses the new level. Access is read from the users table, cached ≤ 15 s, never from the cookie. A deactivated user is refused. | code review (`requireActor`) |
| AC-11 | Given a task is assigned to me (member), when I change its status, then it saves. Any other task is refused. | `task status` test |
| AC-12 | Given an existing data store, when `npm run migrate:settings` runs, then `users` gains `access`, everyone becomes Admin, and a re-run changes nothing. Before it runs, everyone keeps full access and a banner says to run it. | manual (owner runs it) |
| AC-13 | Given the data store is down, when a write action runs, then it is refused (fail closed). | code review (`readUsers` strict in `requireActor`) |
| AC-15 | Given auth is bypassed (local dev / `AUTH_DISABLED`), then the caller acts as Admin. | code review |

### 3.2 Data impact
- `users`: new last column `access` (`lib/schema.ts`). It's optional on read (`USER_REQUIRED_COLUMNS`), so deploying before the migration doesn't break the app.
  - Missing column = admin.
  - Empty or unknown value = member.
- `scripts/migrate-settings.ts` step 4 adds the column and sets everyone to admin. It's idempotent.
- `scripts/seed-data.ts` seeds people as admin.
- **Rollback:** revert the code. The extra column is ignored by the old reader, which checks for missing columns, not extra ones.

### 3.3 Threat model — OWASP Top 10 (2021)
| Risk | Relevant? | Mitigation / evidence |
|---|---|---|
| A01 Broken access control | ✅ core | All 18 writes start with `actorWith(capability)` or `requireActor()` plus a scoped check. Lead scope comes from server-side team data, never from the client. Leads can't widen their own scope (no adding members, no lead change). Members only change the status of their own tasks. Reads keep `requireSession()`. |
| A04 Insecure design | ✅ | Fail closed on outage and on unknown or inactive users. Last-admin guard. Least privilege for new users and unknown values. |
| A05 Misconfiguration | ✅ | Refusals use a generic message; detail goes to the server log only. |
| A07 Auth failures | ✅ | A deactivation or demotion applies on the next action (≤ 15 s cache), not after the 8 h session. |
| A09 Logging | ✅ | `access denied: <action> (uid, level)`; no payloads. |
| A03 / A10 | — | Access value is validated against an allow-list (`isAccessLevel`). No new outbound calls. |
| A02 / A06 / A08 | — | No crypto or dependency changes. |

### 3.4 Laws of UX
| Law | Applied how |
|---|---|
| Hick | One select with 4 levels and a one-line hint for the chosen level |
| Jakob | Familiar "Access level" field in the existing user drawer |
| Postel | Stored value is trimmed and lowercased; unknown values fall back to least privilege |
| Peak-End | Toast names the outcome ("Ana is now a Planner") |
| Tesler | Migration sets everyone to Admin, so no manual seeding is needed |

### 3.5 Mobile-first (375px)
The new select uses `--touch` height inside the existing full-screen drawer. No new layouts.

### 3.6 Out of scope
- Hiding UI per level (slice 2).
- Location-scoped access.
- Custom roles.
- Audit trail.

## 4. 🔨 Implementation checklist
- [x] Smallest diff: guards added in place; the drawer reuses existing field patterns
- [x] Server-side validation (`isAccessLevel`, last admin) + generic errors
- [x] Auth guard on every write action (18/18)
- [x] Banner when the access column is missing (`MigrationNotice`)
- [x] No hardcoded data, `any`, `@ts-ignore`, secrets, stray logs
- [x] No new env vars

## 5. 📏 Verification gates
- [x] **Performance:** the users table is read once per write action. It's the cached read many actions already do. Leads also read teams on roster writes. Build route table unchanged.
- [x] **SEO:** no route changes.
- [x] **Quality:** `npx tsc --noEmit` ✅ · `npm test` 42/42 ✅ · `next build` ✅. The build ran in an isolated copy so the running dev server wasn't disturbed.
- [x] **Constraints:** CLAUDE.md updated (access rule, A01 first-line rule); appsec scan run (no dangerous sinks, RAW only; `MATRIX[level]` is keyed by the allow-listed level)

## 6. ✅ Validation
| AC | Evidence | Result |
|---|---|---|
| AC-2, 4, 5, 9, 11 | `tests/access.test.ts` (7 tests) | ✅ |
| AC-10, 13, 15 | code review of `lib/auth.ts` `requireActor` | ✅ |
| AC-1, AC-12 + member/lead walkthrough | browser with real sign-ins (owner) | ⬜ |

## 7. 🌿 Git & 🚀 release
- [ ] Commit on `feat/rbac` after the owner's browser pass; PR notes that `npm run migrate:settings` must run after deploy
- [ ] Rollback: revert the PR; the `access` column can stay
