# WM capability map & seeded backlog

Maturity: 0 none · 1 manual/implicit · 2 basic · 3 solid · 4 best-in-class.
**Last verified against code: 2026-10-31.** Re-verify (`app/`, `lib/`, README Features) before quoting; update this file when features ship.

## Capability map
| Capability | Maturity | What exists (evidence) | Biggest gap |
|---|---|---|---|
| People directory | 3 | `/users`: location, role, status; teams many-to-many (`/teams`) | No contracted hours / FTE, no skills, no employment dates used in planning |
| Teams | 3 | `/teams`, lead, colour; filters Roster/Tasks/assignee picker | No team-level settings (coverage targets, leave caps) |
| Rostering | 3 | `/roster` month + day views, drag/click, bulk set, clear, CSV import/export, `roster_codes` config | No shift patterns/rotations, no publish/lock, no change history |
| Leave & absence | 1 | Leave codes in `roster_codes` (paid flag), entered by planner on the grid | No requests/approval, balances, entitlement, blackout, planned vs unplanned split |
| Demand / coverage | 0 | Head-count per code on Day view | No required heads per shift/day/location, no under/over-coverage signal |
| Compliance / rest rules | 0 | — | No min rest, max consecutive days, max weekly hours warnings |
| Whereabouts (today) | 3 | `/` daily view, copy-to-chat, unscheduled list | Plan only; no actual attendance / late / call-out |
| Work allocation | 3 | `/tasks` list/kanban/calendar, story points, availability in picker (`lib/capacity.ts`), smart assign (rules + AI) | No skills match, no capacity per person, no workload view across people |
| Capacity view | 1 | Per-assignee availability inside the picker only | No team capacity vs load over weeks (heatmap) |
| Self-service (member) | 1 | PWA, mobile day view, SSO | No "my schedule", no leave request, no swap |
| Reporting / KPIs | 0 | Stat cards per page only | No coverage, shrinkage, utilisation, fairness reports or export |
| Notifications | 0 | Toasts only | No in-app inbox or email/chat on changes |
| Audit trail | 0 | `updatedAt` on some rows | No who-changed-what history |
| Access roles | 1 | Any active user = full access | No planner/lead/member permissions (members can edit everything) |
| Configuration | 3 | `/settings`: codes, locations, roles, statuses, points, general | Missing: coverage targets, rest rules, holidays, skills |

## Seeded backlog (starting point — re-score with RICE before use)
| # | Opportunity | Persona | Why (domain) | Depends on | Size |
|---|---|---|---|---|---|
| 1 | **Coverage targets + heat strip on Roster** — required heads per code × weekday (× location/team) in Settings; roster header shows scheduled/required with ⚠️ under-coverage | Planner | Turns the roster from data entry into planning; closes demand↔supply | — | M |
| 2 | **Leave requests & approval** — member requests on mobile, lead approves seeing coverage impact; approved request writes the leave code to `roster` | Member, Lead | Removes chat-based leave; biggest self-service win | Access roles (lite) | L |
| 3 | **Role-based access (planner / lead / member)** — members read + request; leads approve; planners/admins edit | Admin | Today any member can edit anyone's roster; prerequisite for self-service | — | M |
| 4 | **Shift patterns / rotation fill** — define a pattern in Settings, apply to person/team from a date, skip leave, warn on conflicts | Planner | Cuts monthly rostering from hours to minutes | — | M |
| 5 | **Rest-rule & fairness warnings** — configurable min rest, max consecutive days, max weekly hours; night/weekend counts per person | Planner | Safety + trust; warn, never block | Contracted hours (for weekly max) | M |
| 6 | **My schedule (member home on mobile)** — next 14 days of shifts + my open tasks + ICS export | Member | Highest-reach, low effort, read-only | — | S |
| 7 | **Team capacity heatmap** — people × weeks: working days vs open story points, over/under allocation | Lead | Makes allocation proactive, reuses `lib/capacity.ts` | points-per-day setting | M |
| 8 | **Skills matrix** — skills list in Settings, person × skill × level; filter/score in assignee picker & smart assign | Lead | Better allocation; feeds coverage by skill later | — | M |
| 9 | **Roster publish/lock + change log** | Planner, Member | Members trust a published roster; disputes resolved | Audit trail | M |
| 10 | **Reports: coverage, shrinkage, unscheduled rate, utilisation** (+ CSV) | Ops manager | Measure the loop; justify headcount | #1 for coverage | M |
| 11 | **Public holidays per location** | Planner | Correct coverage and leave counting | — | S |
| 12 | **Shift swap / open-shift claim** | Member, Lead | Self-service flexibility | #2, #3, #5 | L |

Suggested sequence (dependency-aware): **6 → 1 → 3 → 2 → 4 → 5 → 7 → 8 → 10**, with 11 slotted next to 1.
