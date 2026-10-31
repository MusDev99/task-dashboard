# Opportunity brief: Role-based access (RBAC) — access levels

**Status:** ✅ ready for dev (owner decisions recorded 2026-10-31, see §8)
**PO:** Mustaqeem · **Date:** 2026-10-31 · **Backlog #:** 1 · **RICE:** 216 (see `docs/product/backlog.md`)

## 1. Problem
Today **every active user can do everything**: edit anyone's roster, clear a month's schedule, import a CSV over the roster, delete users, change shift codes and settings. CLAUDE.md states it plainly: *"No per-user roles yet."* All 23 exported server actions check only `requireSession()` (signed in), never *who* is signed in.

In WFM this blocks two things:
- **Trust:** a published roster that any member can change isn't a roster people can rely on. One wrong *Clear schedule* or CSV import wipes everyone's month.
- **Self-service:** we can't open WM to the whole workforce (my schedule, leave requests, swaps) until members are *read-mostly*. Backlog items 2 (leave requests), 6 (my schedule) and 12 (swaps) all depend on this.

**Evidence / assumptions**
- ✅ Fact (code): `lib/auth.ts` has `requireSession()` only; `SessionUser` = `{uid, email, exp}`, with no access level.
- ✅ Fact (code): `roles` (`id, name, description, active`) is a **job role** list (shown on Users). It is *not* a permission system and must stay separate.
- ⚠️ Assumption: today's users are mostly planners/leads; members will be onboarded after RBAC. *Validate:* count active users by job role, and ask who should still edit after go-live.

## 2. Outcome & KPI
| Metric | Baseline | Target | How WM measures it |
|---|---|---|---|
| Write actions with a permission check | 0 / 18 | 18 / 18 (100%) | code review + unit test over a permission matrix |
| Members able to change others' roster/tasks/settings | all | 0 | denied-action log (`console.error` with action + uid, no PII payload) |
| Admins | all users | ≤ 3 per org | count of `users.access = admin` |
| *(Leading)* members onboarded after go-live | — | ↑ | active users with `access = member` |

## 3. Access model (recommended)

**Decision:** four **fixed access levels** defined in code, stored per user. Leads are **scoped by the teams they lead** (`teams.leadId`, already in the data). No custom permission matrix in v1.

| Option | Pros | Cons | Pick |
|---|---|---|---|
| A. Fixed levels (Admin / Planner / Lead / Member), team-scoped lead | Simple to explain and test. Reuses Teams. Matches how WFM tools ship | Not customisable per org | ✅ |
| B. Configurable role → permission matrix in Settings | Flexible | Many combinations to test. Easy to lock yourself out. Over-engineered for small/medium teams | later, if asked |
| C. Reuse job `roles` as permission roles | No new field | Mixes "what you do" with "what you may do". A job title change silently changes power | ❌ |

### Permission matrix (v1)
| Capability | Admin | Planner | Lead | Member |
|---|---|---|---|---|
| View Whereabouts, Roster, Tasks, Teams | ✅ | ✅ | ✅ | ✅ |
| Edit roster cells | ✅ all | ✅ all | ✅ **members of teams they lead** | ❌ |
| Clear schedule / import roster CSV | ✅ | ✅ | ❌ | ❌ |
| Create / edit / delete tasks, assign anyone, smart assign | ✅ | ✅ | ✅ | ❌ |
| Change status of a task **assigned to me** | ✅ | ✅ | ✅ | ✅ |
| Create / edit / delete teams | ✅ | ✅ | ✅ only teams they lead (can't delete) | ❌ |
| View Users | ✅ | ✅ | ✅ (read-only) | ❌ (hidden) |
| Create / edit / delete users, change access level | ✅ | ❌ | ❌ | ❌ |
| Operational Settings (codes, locations, roles, statuses, general) | ✅ | 👁 read-only | ❌ | ❌ |

Principle check: *warn, never block* covers **availability** (the planner's judgement call). Permissions are a **security boundary**, so they block, with a clear message.

## 4. Personas & stories
| ID | Story | MoSCoW |
|---|---|---|
| US-1 | As an **admin**, I want to set each person's access level in Users, so that only the right people can change the plan. | Must |
| US-2 | As a **member**, I want to see the roster and my tasks without being able to break anything, so that I can trust what I see. | Must |
| US-3 | As a **lead**, I want to edit the roster and tasks of the people in my teams, so that I can handle the day without waiting for the planner. | Must |
| US-4 | As a **planner**, I want full roster and task control without access to user admin or settings, so that I can plan safely. | Must |
| US-5 | As anyone, I want screens to hide the actions I can't use, and to tell me why if I reach one, so that I'm not confused by errors. | Must |
| US-6 | As an **admin**, I want the system to stop me from removing the last admin, so that we can never lock ourselves out. | Must |
| US-7 | As a **member**, I want to move my own task between statuses, so that my lead sees progress without chasing me. | Should |
| US-8 | As an **admin**, I want a history of access changes. | Could (needs audit trail, backlog #9) |

## 5. Acceptance criteria
| ID | Story | Given / When / Then |
|---|---|---|
| AC-1 | US-1 | Given I'm an admin, when I edit a user in the drawer, then I can pick **Access: Admin / Planner / Lead / Member**; it's saved and a toast says "Ana is now a Planner". |
| AC-2 | US-1 | Given a new user is created without choosing, then access defaults to **Member** (least privilege). |
| AC-3 | US-2 | Given I'm a member, when I open Roster or Tasks, then I see data but no edit affordances (no cell picker, no drag, no New task, no row menus except "View"). Settings and Users are hidden from navigation. |
| AC-4 | US-2 | Given I'm a member, when a write action is called directly (crafted POST), then the server refuses with a generic "You don't have permission to do that." and logs action + uid. **No data changes.** |
| AC-5 | US-3 | Given I lead team A (members X, Y) and not team B (member Z), when I edit X's and Z's cells in one drag, then X's save and Z's are refused as a whole batch. The toast names how many were refused, and the grid rolls back Z (optimistic rollback). |
| AC-6 | US-3 | Given I'm a lead, the Roster greys out rows I can't edit (with a lock icon and text, not colour only) and defaults the team filter to my teams. |
| AC-7 | US-4 | Given I'm a planner, when I open `/settings`, then I see every section read-only, with a notice "Only admins can change settings". |
| AC-8 | US-5 | Given I reach `/users` as a member by URL, then I see a "You don't have access to this page" state with a link home, not a 500. |
| AC-9 | US-6 | Given I'm the only active admin, when I change my access, deactivate myself or delete myself, then it's refused: "At least one active admin is required." |
| AC-10 | — | **Freshness:** given an admin demotes Ana, then Ana's *next action* is checked against the new level. Access is read from `users` per request, **not** from the 8h session cookie. |
| AC-11 | US-7 | Given a task is assigned to me (member), when I change its status, then it saves; any other field edit is refused. |
| AC-12 | — | **Migration:** given an existing data store, when `npm run migrate:settings` runs, then `users` gains an `access` column and **every existing active user becomes `admin`** (no one loses access on deploy). The owner then downgrades people. The script is idempotent. |
| AC-13 | — | **Error:** given the data store is unavailable when checking access, then the action is refused (fail closed) with the generic error banner, never allowed. |
| AC-14 | — | **375px:** read-only states and the access select work at phone width. The FAB is hidden when the user can't create. |
| AC-15 | — | **Auth bypass (local dev / `AUTH_DISABLED`)** acts as admin, unchanged from today, and is documented. |

## 6. Data & config impact
- `lib/schema.ts`: append **`access`** to `USER_COLUMNS` (values `admin|planner|lead|member`). Appending at the end keeps the column order safe. `assertColumns` will require it, so the migration must run before deploy.
- `lib/migrate-settings` (`npm run migrate:settings`): add the column and backfill existing users with `admin` (AC-12).
- New pure module `lib/access.ts` (unit-tested), roughly:
  - `can(level, capability, ctx)`
  - `leadScope(uid, teams, members)`
  - matrix as data
- New guard in `lib/auth.ts`, for example `requireAccess(capability, ctx?)`. It reads the user's row (cached per request) and replaces `requireSession()` as the first line of write actions; `requireSession()` stays for reads.
- Validation (`lib/validation.ts`): `access` must be one of the 4 values; only admins may set it; last-admin rule.
- Read-only pages: pass `can` flags from server components to client components (no permission logic in the client beyond hiding UI).
- Revalidate `/users` (and the sidebar) after access changes.
- Docs: README (features, migration step, changelog), CLAUDE.md (replace "No per-user roles yet" with the access rule, plus "first line of every write action: `requireAccess`").
- **No new settings table** (levels are fixed, by decision).

## 7. UX notes
- Users drawer: a field labelled **"Access level"** (not "Role", which already means job role), each option with a one-line description. Also a filter and badge on the Users list.
- Sidebar: show only the routes the user can open. Members get a cleaner nav (Hick).
- Read-only is quiet, not shouty: no disabled buttons everywhere; hide them. Show one explanatory line where a whole section is read-only.
- Laws of UX:
  - **Hick:** fewer choices for members.
  - **Jakob:** familiar "access level" pattern.
  - **Peak-End:** a toast naming the change.
  - **Postel:** trim and lowercase the stored value.

## 8. Risks & open questions
| Risk / question | Mitigation / owner |
|---|---|
| Lock-out on deploy | AC-12 backfill to admin + AC-9 last-admin rule |
| Stale power for up to 8h after a demotion | AC-10: check `users` per action, not the cookie |
| Extra data-store read per action | One cached `users` read per request (actions already read `users` for validation; reuse it) |
| Lead edits a person who is in two teams, only one of which they lead | Allowed (any shared led team grants scope). ✅ **Owner decided:** yes, a lead may edit their roster |
| Should leads edit tasks of people outside their teams? | v1: yes, since tasks don't store a team (CLAUDE.md). ✅ **Owner decided:** yes, leads may edit tasks outside their teams |
| Should planners see Settings at all? | ✅ **Owner decided:** planners can view Settings only (read-only); leads and members cannot see it |
| Member visibility of others' leave codes (privacy, e.g. sick leave) | Out of v1; candidate follow-up "mask leave reason for members" |

## 9. Out of scope (this slice)
- Custom roles or a permission matrix editor (option B).
- Location-scoped access (e.g. planner for one station only), which is a likely v2.
- Audit trail of access changes (backlog #9).
- Leave requests, my-schedule and swaps (they *build on* this).
- Approval workflows.

## 10. Handoff
Next: `/dev-workflow` with `docs/product/briefs/rbac.md` → `docs/features/rbac/feature.md`. Suggested slices:
1. `lib/access.ts` + `requireAccess` on all write actions + migration (security value on its own).
2. Read-only UI, nav hiding and the no-access page.
3. Lead team-scoping on the roster.
4. Member "my task status".

Run `appsec-review` (new guard on every server action).
