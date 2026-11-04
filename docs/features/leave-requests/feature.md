# Feature: Leave requests

**Status:** ✅ verified in a real browser (fake Google + in-memory store) · **Branch:** `ccr-62221fdb-cy33y0`

## 1. 🧠 Brainstorm
**Problem** — leave is arranged in chat and typed into the roster by a planner, with no record of who asked, who agreed or why.

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. Request → approve workflow; approval writes roster rows | One source of truth, audit trail, reuses roster and RBAC | Needs a new table and page | M | ✅ |
| B. Members edit their own roster cells | Trivial | No approval, breaks "members are view-only" | S | ✗ |
| C. Link out to a form | Zero code | Data lives elsewhere | S | ✗ |

**Decision:** A.

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | Pure `lib/leave.ts` + tests; capabilities | ✅ |
| 2 | `leave_requests` table, request / cancel / decide actions (audit-logged) | ✅ |
| 3 | `/leave` page: request dialog, approve, reject-with-reason, cancel | ✅ |
| 4 | Browser e2e with in-memory multi-tab fake store | ✅ |
| 5 | Revoke approved leave; notifications; calendar/ICS; leave balances | ⬜ |

## 3. 🔬 Feature analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | A signed-in person requests a leave type for a date range → a *pending* request for themselves is stored (never for someone else) | e2e |
| AC-2 | Past start, end before start, > 62 days, > 366 days ahead, inactive/unknown type, note > 200 → refused with inline errors | unit |
| AC-3 | Overlap with their own pending/approved request is refused; rejected/cancelled don't block | unit + e2e |
| AC-4 | Admin/planner approves → leave code is written to the roster for every day, then the request is marked approved; days that replaced a shift are counted in the message | e2e |
| AC-5 | A lead decides only for people in teams they lead, never their own; members never decide | unit |
| AC-6 | Only pending requests move; approved/rejected/cancelled can't be decided again | unit + e2e |
| AC-7 | The requester can cancel a pending request; nobody else can | e2e |
| AC-8 | Reject can carry a reason, shown to the requester; roster untouched | e2e |
| AC-9 | Members see only their requests, leads theirs + their teams', planners/admins all | unit |
| AC-10 | Every request / decision / cancel is audit-logged; deleting a user deletes their requests | e2e / manual |
| AC-11 | 375px: no horizontal scroll, table collapses to cards, ≥ 44px actions | e2e |

**Data impact:** new lazy tab `leave_requests` (`LEAVE_COLUMNS`). No migration. Rollback: ignore the tab; roster rows written by approvals stay (they are ordinary roster days).
**OWASP:** A01 `actorWith("leave.request"|"leave.decide")` first line of every action; requester taken from the session, scope checked on the server and fails closed; hiding buttons is UX only. A03 all input cleaned and validated server-side; notes rendered as text. A04 approval order (roster first, status second) avoids an approved-but-empty state. A09 audit entries carry no secrets.
**Laws of UX:** Fitts (edge FAB on phones), Hick (Approve/Reject/Cancel only), Jakob (table + status pills + dialog), Miller (3 stat cards, 10 rows/page), Doherty (pending state on buttons, toasts), Postel (a single day needs only a start date), Peak-End (toast says how many days and shifts replaced), Von Restorff (one filled button per row), Tesler (the system writes the roster).

**Known limits:** approved leave can't be revoked from the app yet (an approver clears the roster days by hand); two approvers racing on the same request is last-write-wins on a non-transactional store (the second sees "already dealt with" on refresh); no notifications; no leave balances.

## 5–6. Verify / validate
`npm run verify` green. `node scripts/e2e/leave.e2e.mjs`: 21 checks in a real browser (member, planner, admin; desktop and 375px).
