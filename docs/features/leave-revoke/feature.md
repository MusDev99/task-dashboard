# Feature: Revoke approved leave

**Status:** ✅ verified in a real browser (fake Google + in-memory store) · **Branch:** `ccr-62221fdb-cy33y0`

## 1. 🧠 Brainstorm
**Problem** — once leave is approved it lives on the roster; if plans change or cover is needed, someone has to find and clear each day by hand, and nobody is told.

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. Revoke action: clears the still-matching future roster days, updates the request, notifies the other side | One step, safe, auditable | Needs rules for leave already under way | M | ✅ |
| B. Let approved leave be re-edited | Flexible | Re-approval and overlap logic, much more surface | L | ✗ |
| C. Leave it to planners editing the roster | No code | Today's pain | — | ✗ |

**Decision:** A. Requester may take back their own; approvers may revoke. Days already gone are history, so a request under way is **shortened** rather than erased.

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | Pure `planRevoke`, `canRevokeLeave`, `canTransition(approved → revoked)` + tests | ✅ |
| 2 | `revokeLeave` action: roster first, request second, audit, notify | ✅ |
| 3 | Row action + confirm dialog stating exactly what is removed | ✅ |
| 4 | Browser e2e with seeded approved leave; shared e2e harness | ✅ |
| 5 | Partial revoke (choose which days); approval re-request | ⬜ |

## 3. 🔬 Feature analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | The requester may cancel their own approved leave; admins, planners and leads (their teams) may revoke it; nobody else | unit + e2e |
| AC-2 | Only approved leave can be revoked; revoked is final | unit |
| AC-3 | Leave not yet started → all its days from the start are cleared and the request becomes *Revoked* | unit + e2e |
| AC-4 | Leave under way → today onwards is cleared, past days stay, the request ends yesterday and stays *Approved* with a note of the original end | unit + e2e |
| AC-5 | A day whose roster cell no longer holds the leave code (a planner changed it) or has no row is left alone and counted | unit + e2e |
| AC-6 | Leave that has already ended cannot be revoked (no button; server refuses) | unit + e2e |
| AC-7 | The roster is cleared before the request is updated, so a failure leaves a retryable approved request | by design |
| AC-8 | The confirm dialog says how many remaining days and the date range, that past days stay (if applicable), and has Cancel ("Keep leave") as the default focus | e2e |
| AC-9 | Requester cancelling → approvers notified; approver revoking → requester notified; never the person who did it | e2e |
| AC-10 | Audit entry states what was cleared and what was left as it was | e2e |
| AC-11 | At 375px the dialog is a fully visible bottom sheet, no horizontal scroll | e2e |

**Data impact:** new status value `revoked` (text); a shortened request's `endDate` changes; roster rows are deleted. No migration. Rollback: none needed (roster days can be re-added by a planner).
**OWASP:** A01 `actorWith("leave.request")` then the requester/approver/team-scope check on the server, failing closed if teams can't be read; the client only hides the button. A03 note cleaned and capped. A04 order of writes. A09 audit summary has no secrets.
**Laws of UX:** Tesler (the system clears the right days), Postel (a day changed since is left alone, not an error), Peak-End (toast counts cleared and left-alone days), Hick (one action per row, confirm only), destructive-confirm rule (states exactly what is removed; Cancel default focus).

**Known limits:** all-or-nothing from today (no choosing days); a revoked request can't be re-opened (the person files a new one); the "left alone" days include days that simply had no row, which the toast words as "changed since".

## 5–6. Verify / validate
`npm run verify` green; `node scripts/e2e/revoke.e2e.mjs` 19 checks and `node scripts/e2e/leave.e2e.mjs` 33 checks (member, planner, admin; desktop + 375px).
