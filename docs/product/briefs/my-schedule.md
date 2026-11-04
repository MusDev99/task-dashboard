# Opportunity brief: My schedule

**Status:** 🚧 in dev (slice 1 on `feat/my-schedule`; owner took the PO defaults for §8 on 2026-11-03)
**PO:** Mustaqeem · **Date:** 2026-11-02 · **Backlog #:** 2 · **RICE:** 128

## 1. Problem
A team member's two questions are *"when do I work?"* and *"what am I working on?"*. Today WM answers neither for the person themselves:
- The Roster shows everyone. On a phone, a member scrolls the Day view day by day, or the Month grid, to find their own row.
- Tasks shows the team's board. "Mine" means filtering by assignee every time.
- Nothing works outside the app. People screenshot the roster and post it in chat, which goes stale the moment a planner changes a cell.

RBAC (parts 1–3) made members view-only, so WM is now safe to open to the whole workforce. My schedule gives them a reason to open it.

**Evidence / assumptions**
- ✅ Fact (code):
  - Roster rows are `{userId}_{date}` with a code.
  - Shift label, start/end, hours and colour come from `getShiftConfig()`.
  - Tasks have `assigneeId`, `startDate`, `dueDate` and an open/closed status (`task_statuses.open`).
  - The org timezone is in `app_settings`, and `todayIn(tz)` exists.
- ✅ Fact (code): there is no per-person view anywhere. `/` is everyone's whereabouts for one day.
- ⚠️ Assumption: most members open WM on a phone (it's a PWA). *Validate:* ask 3–5 members; check installs after launch.
- ⚠️ Assumption: members want shifts in their phone calendar. *Validate:* count ICS subscriptions after launch (slice 2).

## 2. Outcome & KPI
| Metric | Baseline | Target | How WM measures it |
|---|---|---|---|
| Members who open WM weekly | ~0 (no reason to) | ≥ 60% of active members within 4 weeks | sign-ins per uid per week (server log of session creation) |
| "When am I working?" questions in team chat | many (anecdotal) | ↓ | ask leads at 2 and 4 weeks (qualitative) |
| *(Slice 2)* people subscribed to the calendar feed | 0 | ≥ 30% of members | count distinct feed tokens fetched in 7 days |

## 3. Personas & stories
| ID | Story | MoSCoW |
|---|---|---|
| US-1 | As a **member**, I want to see my shifts and leave for the next 14 days in one list, so that I know when I work without searching the roster. | Must |
| US-2 | As a **member**, I want to see my open tasks, with the ones due soon first, so that I know what to work on. | Must |
| US-3 | As a **member**, I want today highlighted with my shift times, so that I can check at a glance before leaving home. | Must |
| US-4 | As a **member**, I want to move my task's status from this page, so that I don't have to find it on the board. | Should |
| US-5 | As a **member**, I want WM to open on My schedule, so that the first screen is about me. | Should |
| US-6 | As **anyone with a roster row** (leads, planners too), I want the same page for myself. | Must (same page, every level) |
| US-7 | As a **member**, I want to add my shifts to my phone calendar and have them update, so that I see them next to my personal plans. | Could (slice 2) |

## 4. Acceptance criteria
| ID | Story | Given / When / Then |
|---|---|---|
| AC-1 | US-1 | Given I'm signed in, when I open **My schedule** (`/me`), then I see 14 days from today (org timezone), one row per day. Each row has weekday + date and my code chip with label and times (e.g. "Morning · 06:00–14:00"), or "Not scheduled". |
| AC-2 | US-1 | Leave days show the leave label (text + chip, not colour only). Weekends and public holidays are marked the same way as on the Roster. |
| AC-3 | US-3 | Today is pinned at the top as a card: today's shift and times, or "Day off" / leave label / "Not scheduled". |
| AC-4 | US-1 | A summary line shows working days and hours in the 14 days, from `roster_codes.hours` (no hardcoded hours). |
| AC-5 | US-2 | Below the days, **My tasks**: open tasks and subtasks assigned to me. Overdue first (marked "Overdue"), then by due date, then undated. Each shows code, title, status, due date and parent title for subtasks. Tapping one opens it in Tasks. |
| AC-6 | US-4 | Each task has a status control (same statuses as the board). Changing it saves through `setTaskStatus` (members are allowed only on their own tasks) and shows a toast "TSK-0012 moved to Done". |
| AC-7 | US-5 | Given I'm a **member**, when I sign in without a deep link, then I land on `/me`. Other levels still land on `/` unless §8 Q2 says otherwise. The bottom tab bar and sidebar get a **My schedule** item for everyone. |
| AC-8 | — | **Empty:** no roster rows in 14 days → "No shifts planned in the next 2 weeks. Your planner hasn't scheduled you yet." No open tasks → "Nothing assigned to you." |
| AC-9 | — | **Error:** if the data store is unavailable, show the standard error banner. The page never throws to a 500. |
| AC-10 | — | **375px first:** single column, today card above the fold, rows ≥ 44px, no horizontal scroll. Desktop: days and tasks side by side. |
| AC-11 | — | **Privacy:** the page only ever reads and shows the signed-in person's own rows (server-side filter by session uid). No `?user=` parameter in v1. |
| AC-12 | — | **No account match** (auth bypassed in dev): show a notice "My schedule needs a signed-in user". |
| AC-13 | US-7 (slice 2) | **Calendar feed:** "Add to calendar" gives a personal, revocable ICS URL with a random token (not the session cookie). The feed contains only that person's shifts and leave for -7…+60 days, with times in the org timezone. Rotating the token kills the old URL. |

## 5. Data & config impact
- **Slice 1: no new tables or columns.** Reads `roster` (current and next month, since 14 days can cross a month), `roster_codes`, `work_tasks`, `task_statuses` and `app_settings`.
- New pure module `lib/my-schedule.ts` (unit-tested): `buildDays(entries, codes, today, n)` and `myOpenTasks(tasks, uid, config, today)` for sort, overdue and parent titles.
- New route `app/me/` (`page.tsx` with `force-dynamic`, `MyScheduleClient.tsx`, `loading.tsx`). Uses `viewer()` for the uid. Reuses `CodeChip`, `StatusPill` and `setTaskStatus`.
- Login landing: the callback's default `next` becomes `/me` for members (still through `safeNext`).
- *Slice 2 (ICS):* new `calendar_tokens` table (`id`, `userId`, `token` hash, `createdAt`). A public route `/api/calendar/[token].ics` is excluded in `proxy.ts`, rate-limited, and returns only that user's shifts. It needs an `appsec-review` (new public endpoint) and a CSP/headers check.

## 6. UX notes
- Entry point: **My schedule** as the first tab in the bottom bar on phones, and an item in the sidebar.
- Layout (phone): Today card → "Next 14 days" list (date column + chip) → "My tasks".
- Laws of UX:
  - **Hick:** nothing to configure, one page.
  - **Miller:** 14 days, chunked by week with a "Week of 3 Nov" header (uses `weekStart`).
  - **Fitts:** status control and rows ≥ 44px.
  - **Jakob:** an agenda list like phone calendars.
  - **Doherty:** status changes are optimistic.
  - **Peak-End:** a toast after each status change.
- Copy: speak to the person ("You're on Morning, 06:00–14:00"). Show names, never ids.

## 7. Out of scope (this slice)
- Viewing someone else's schedule (`?user=`), which belongs to leads later.
- Requesting leave or swaps from this page: backlog #4 and #12 (the page will host those buttons later).
- Push or email notifications when my roster changes.
- Hours worked vs contracted (needs contracted hours, not in the data model).
- ICS feed (slice 2, after slice 1 ships and members use it).

## 8. Owner decisions (2026-11-03: PO recommendations accepted)
| # | Question | PO recommendation |
|---|---|---|
| Q1 | Horizon: 14 days, or "this week + next week" aligned to `weekStart`? | **14 days from today.** Simpler, and always shows two weeks ahead. |
| Q2 | Should every level land on `/me` after sign-in, or only members? | **Members only.** Leads and planners start on the team view (`/`). |
| Q3 | Include subtasks assigned to me under My tasks? | **Yes.** Show the parent title as context. |
| Q4 | Do slice 2 (calendar feed) now or later? | **Later.** It's a new public endpoint, so it needs its own security review. Validate demand first. |

## 9. Risks
| Risk | Mitigation |
|---|---|
| Showing another person's data by mistake | uid comes only from the session on the server; unit test that the filter uses the uid; no client-supplied user id |
| 14 days span two months → two roster reads | `getRoster` per month, both cached (≤ 2 reads) |
| Member whose `googleId`/email isn't linked lands on an empty page | Covered by AC-12; registration already requires a users row |

## 10. Handoff
Next: `/dev-workflow` with `docs/product/briefs/my-schedule.md` → `docs/features/my-schedule/feature.md`.
- **Slice 1:** `/me` read-only, plus task status changes and member landing. Size S, about 0.5 week.
- **Slice 2:** ICS feed, after the security review.
