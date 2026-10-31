# WFM & resource planning — domain reference

Use this vocabulary with users, but always map it to something in WM (table, screen, setting).

## 1. The WFM loop
```
Forecast demand → Capacity plan → Schedule (roster) → Intraday / real-time → Track actuals → Report & learn ─┐
        ↑──────────────────────────────────────────────────────────────────────────────────────────────────┘
```
| Stage | Question it answers | Typical artefacts | WM today |
|---|---|---|---|
| Forecast | How much work / how many heads will we need? | volume per interval, required heads per shift | ❌ none (tasks have story points, no coverage targets) |
| Capacity plan | Do we have enough people (FTE) over the next weeks/months? | FTE requirement vs available FTE, hiring/leave plan | ⚠️ implicit (roster counts only) |
| Schedule | Who works which shift on which day? | roster, shift patterns, leave calendar | ✅ `/roster` (month/day, drag, CSV) |
| Allocate work | Who does which piece of work? | assignments, skills match, workload | ✅ `/tasks` + availability + smart assign |
| Intraday | Who's actually here now, what changed? | attendance, swaps, call-outs | ⚠️ `/` whereabouts is plan-only |
| Track & report | Did we hit coverage, utilisation, fairness? | adherence, utilisation, overtime, absence rate | ❌ none |

## 2. Core concepts
| Term | Meaning | Notes for WM |
|---|---|---|
| **Demand / requirement** | Heads (or hours) needed per shift/day/location/skill | Would be a new settings table, e.g. coverage targets per code × weekday × location |
| **Supply / availability** | Scheduled people minus leave/absence | Already derivable from `roster` + `roster_codes` (paid/leave flags) |
| **Coverage** | supply ÷ requirement for a slot | Under < 100%, over > ~110%; show as heatmap on the roster header |
| **FTE** | Full-time equivalent (e.g. 1.0 = 40h/week) | Needs contracted hours per user (new column) |
| **Shrinkage** | % of paid time not available for work (leave, training, sick, meetings) | `shrinkage = non-productive paid hours ÷ total paid hours`; planned vs unplanned |
| **Utilisation** | productive (assigned) time ÷ available time | For tasks: open story points vs capacity points over the window |
| **Occupancy** | busy time ÷ logged-in time (contact-centre term) | Usually not relevant unless queue work is added |
| **Adherence / conformance** | did people work the scheduled shift (on time, right shift)? | Needs actuals / check-in; future |
| **Absenteeism** | unplanned absence days ÷ scheduled days | Separate planned leave codes from unplanned (sick, no-show) in `roster_codes` |
| **Bradford factor** | S² × D (spells² × days) — highlights frequent short absences | Sensitive; HR-only, opt-in |
| **Shift pattern / rotation** | repeating template (e.g. 4-on-4-off, 2D-2N-4off) | Big time-saver: "apply pattern to person from date" |
| **Skills matrix** | person × skill × proficiency (1–4) + certification expiry | Enables skills-based coverage and better assignee suggestions |
| **Bench** | available people with no allocated work | Open points = 0 over the window |
| **Over-allocation** | assigned load > capacity in a window | `lib/capacity.ts` already computes working days + open points |
| **Leave entitlement / balance** | days per year, accrued/taken/remaining | New `leave_requests` + balances; approval flow |
| **Blackout period** | dates where leave isn't allowed / capped | Configurable per team/location |
| **Shift swap / bid** | member-initiated exchange, approved by lead | Self-service, mobile |
| **Rest rule** | min hours between shifts (e.g. 11h), max consecutive days, max weekly hours | Warn, never block; configurable per org (confirm with HR/legal) |
| **Fairness** | even distribution of nights, weekends, public holidays, unpopular shifts | Per-person counters over a period |
| **Public holiday calendar** | per location | Needed for coverage and leave counting |

## 3. Formulas you can compute from WM tables
| KPI | Formula | Source |
|---|---|---|
| Daily coverage % | scheduled working heads ÷ required heads (per code/location/day) | `roster` + `roster_codes` + *new* coverage targets |
| Planned shrinkage % | leave/non-working paid days ÷ total scheduled paid days | `roster` + `roster_codes.paid` |
| Unscheduled rate | active users with no roster row ÷ active users, per day | `users` + `roster` (already in Whereabouts) |
| Task utilisation | open story points in window ÷ (working days × points-per-day) | `work_tasks` + `lib/capacity.ts` (needs a points-per-day setting) |
| On-time delivery | done tasks with doneAt ≤ dueDate ÷ done tasks | `work_tasks` (needs completion timestamp) |
| Night/weekend share | person's nights (or weekend shifts) ÷ team average | `roster` + code type |
| Roster lead time | days between roster publish and first day | needs a "published" state |

## 4. Industry patterns worth borrowing
- **Publish / lock** a roster period (draft → published → locked), with change log after publish.
- **Coverage heat strip** above the roster grid (red/amber/green with numbers, never colour alone).
- **Pattern fill**: pick a rotation, a person/team and a start date → fill the month; conflicts shown, not overwritten.
- **Leave request inbox**: member requests on mobile → lead sees impact on coverage before approving.
- **Open shifts**: uncovered slots offered to eligible people (skill + rest-rule OK) to claim.
- **What-if**: "if X takes leave 3–7 Nov, coverage on Night drops to 60%".
- **Skills-aware assignment**: filter/score assignees by required skill + proficiency + availability (extend smart assign).
- **My schedule** (member view): next 14 days of shifts + tasks, add to calendar (ICS).
- **Audit trail**: who changed which roster cell / task, when — builds trust and resolves disputes.
- **Notifications**: shift changed, leave decided, task assigned (start with in-app, then email/chat).

## 5. Anti-patterns to push back on
- Hard blocks on assignment/rostering (planners will route around the tool).
- Optimisers/AI before the inputs exist (no demand targets, no skills ⇒ garbage out).
- Hidden logic: any automatic decision must show *why*.
- Colour-only status, desktop-only member flows.
- Per-org rules hardcoded in components.
