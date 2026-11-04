# Feature: Coverage targets + roster rules

**Status:** 🔨 building (logic and build verified; browser pass pending) · **Branch:** `ccr-62221fdb-cy33y0`

## 1. 🧠 Brainstorm
**Problem** — planners can't see at a glance whether every shift has enough people, or whether a schedule breaks rest / hours limits. In aviation ops both matter (minimum crew, fatigue).

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. Settings-managed targets + limits, pure checks, one Roster panel | Fits existing settings/pure-logic patterns; grid untouched (stays fast) | No per-cell highlight yet | M | ✅ |
| B. Heat strip + per-cell markers in the grid | Most visual | Touches the memoised grid; risk to 60fps | L | later |
| C. Hard blocks on violation | Strict | Conflicts with "availability warns, never blocks" | M | ✗ |

**Decision:** A. Warnings only.

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | Pure `coverage.ts`, `roster-rules.ts` + tests | ✅ |
| 2 | `coverage_targets` entity in Settings, rule limits in General | ✅ |
| 3 | Roster "Coverage & rules" panel (live with optimistic edits) | ✅ |
| 4 | Heat strip / per-cell markers in the Month grid; fairness (weekend/night share) | ⬜ |

## 3. 🔬 Feature analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | A target "NS ≥ 3 at KUL, Mon–Fri" and 2 people on NS at KUL on a Tuesday → a gap "2 of 3 needed" is listed | unit |
| AC-2 | Inactive people and people at other locations don't count; inactive targets are ignored | unit |
| AC-3 | Weekday/weekend targets apply only on their days | unit |
| AC-4 | More than N shift days in a row → one warning on the day that breaks the limit; leave/empty days break a run; runs crossing the month edge count | unit |
| AC-5 | Rest between consecutive-day shifts below the minimum (overnight end handled) → warning on the later day | unit |
| AC-6 | Hours in a week (per configured week start) above the limit → warning at the week start (clipped to the month) | unit |
| AC-7 | A limit of 0 switches that rule off; no targets and all rules off → no panel | unit + manual |
| AC-8 | Target needs an existing active shift and (if set) active location; duplicate shift+location+days refused; min is a whole number 1–999 | unit |
| AC-9 | Deleting a shift or location removes its targets first | manual |
| AC-10 | Edits on the grid update the panel instantly and nothing is ever blocked | manual |

**Data impact:** new lazy tab `coverage_targets`; new `app_settings` keys (defaults 6 / 11 / 48 when absent). No migration. Rollback: ignore the tab / keys.
**OWASP:** A01 settings writes stay `settings.edit` (admin); Roster panel is read-only data the viewer already sees. A03 server-side validation of every field and reference (`validateCoverageRecord`, `validateCoverageRefs`). A09 changes are written to the audit log.
**Laws of UX:** Hick (one collapsed panel, 12 items then "+N more"), Von Restorff (warning colour only when something needs attention), Doherty (computed client-side), Peak-End (clear "All clear this month"), Tesler (the system finds the gaps). 375px: panel is a single column `<details>`, ≥ 44px summary row.

**Known limits:** weeks/runs are judged from loaded data (current ± 1 month); a run that already broke the limit in the previous month is reported there, not here.

## 5–6. Verify / validate
`npm run verify` green. Browser pass (375px/desktop, empty/error/keyboard): ⬜ pending (needs data-store credentials).
