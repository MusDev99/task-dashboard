# Code review — <branch / PR>

**Reviewer:** <name or Claude> · **Date:** <YYYY-MM-DD> · **Base:** `main` · **Feature doc:** `docs/features/<slug>/feature.md`
**Verdict:** ✅ approve · 🔁 changes requested · ⛔ blocked

## Summary
| 🔴 | 🟠 | 🟡 | 🔵 |
|---|---|---|---|
| 0 | 0 | 0 | 0 |

## Findings
| # | Sev | Area | Location | Problem (input -> wrong result) | Suggested fix |
|---|---|---|---|---|---|
| 1 | | | `file:line` | | |

## Checklist (✅ ok · ⚠️ concern · ❌ fail · ➖ n/a)
| Area | Check | Result |
|---|---|---|
| Correctness | Matches every AC in feature.md; edge cases (empty, duplicate, concurrent edit, timezone) | |
| Security | Auth on every new route/action/endpoint; server-side validation; no secrets; generic errors | |
| Security | No injection: formula injections, `javascript:` URLs, unescaped HTML, SQL-like filters | |
| Security | CSRF/origin check on cookie-authenticated writes; redirects only to same-site paths | |
| Security | New outbound requests go to fixed hosts; user input is encoded | |
| UX | Laws of UX applied and noted (Hick, Fitts >= 44px, Jakob, Miller, Doherty, Postel, Tesler, Peak-End) | |
| Mobile | Works at 375px, no horizontal scroll, thumb-reachable primary action, drawers/tables collapse | |
| A11y | Labels, focus ring, keyboard path, `role=alert` for errors, not colour-only | |
| Performance | No N+1 data-store calls, heavy libs lazy, no unnecessary re-fetch/re-render | |
| Conventions | Matches surrounding code and CLAUDE.md; reuses existing helpers; strict types (no `any`) | |
| Tests | New logic has unit tests; bug fix has a regression test; tests are deterministic | |
| Docs | README / CHANGELOG / CLAUDE.md / `.env.example` updated | |
| Git | Focused commits, Conventional Commit messages, no unrelated changes, no generated noise | |

## Positive notes
- 

## Follow-ups (tracked)
- 
