# Code review — Smart assign (AI pilot) · `claude/project-thread-t3t50g`

**Reviewer:** Claude · **Date:** 2026-10-28 · **Base:** `master` · **Feature doc:** `docs/features/smart-assign/feature.md`
**Verdict:** ✅ approve (pilot)

## Summary
| 🔴 | 🟠 | 🟡 | 🔵 |
|---|---|---|---|
| 0 | 0 | 1 | 1 |

## Findings
| # | Sev | Area | Location | Problem (input -> wrong result) | Suggested fix |
|---|---|---|---|---|---|
| 1 | 🟡 | UX | `app/tasks/SmartAssign.tsx` | Suggestions don't refresh when dates/title change after *Suggest* -> list can be stale | Press *Suggest again*; follow-up: mark stale when inputs change |
| 2 | 🔵 | UX | `app/tasks/SmartAssign.tsx` | In AI mode a lower rule score can be listed above a higher one (AI used past work to re-rank) | Tooltip explains "rule score"; revisit after pilot feedback |

## Checklist (✅ ok · ⚠️ concern · ❌ fail · ➖ n/a)
| Area | Check | Result |
|---|---|---|
| Correctness | Matches every AC in feature.md; edge cases (empty, duplicate, concurrent edit, timezone) | ✅ (no candidates, no dates, no title, junk AI output covered) |
| Security | Auth on every new route/action/endpoint; server-side validation; no secrets; generic errors | ✅ `requireSession()` first, `cleanSuggestInput`, generic notes |
| Security | No injection: formula injections, `javascript:` URLs, unescaped HTML, SQL-like filters | ✅ read-only; AI text rendered as React text |
| Security | CSRF/origin check on cookie-authenticated writes; redirects only to same-site paths | ➖ read-only server action (Next origin check applies) |
| Security | New outbound requests go to fixed hosts; user input is encoded | ✅ Claude API via SDK only |
| UX | Laws of UX applied and noted | ✅ see feature.md §3.4 |
| Mobile | Works at 375px, no horizontal scroll, thumb-reachable primary action, drawers/tables collapse | ✅ |
| A11y | Labels, focus ring, keyboard path, `role=alert` for errors, not colour-only | ✅ `aria-live`, `aria-busy`, `aria-pressed`, labelled team select |
| Performance | No N+1 data-store calls, heavy libs lazy, no unnecessary re-fetch/re-render | ✅ SDK is server-only (not in client bundles) |
| Conventions | Matches surrounding code and CLAUDE.md; reuses existing helpers; strict types (no `any`) | ✅ reuses `availability`, `createRateLimiter`, `Avatar`, `SparkIcon` |
| Tests | New logic has unit tests; bug fix has a regression test; tests are deterministic | ✅ 8 new tests |
| Docs | README / CHANGELOG / CLAUDE.md / `.env.example` updated | ✅ |
| Git | Focused commits, Conventional Commit messages, no unrelated changes, no generated noise | ✅ |

## Positive notes
- Model can't invent people or scores: it only re-orders a pseudonymised shortlist.
- Works fully without a key.

## Follow-ups (tracked)
- Pilot with a real key; 👍/👎 feedback on picks; optional skills field on users; log token usage for cost.
