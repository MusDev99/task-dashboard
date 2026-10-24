# Feature: Teams

**Status:** 🔨 building
**Owner:** Mustaqeem · **Branch:** `ccr-842b3a88-ddan6t` (agent session branch) · **Issue/PR:** — · **Target version:** next minor

## 1. 🧠 Brainstorm
**Problem** — People can't be grouped. Leads plan the roster and assign tasks person by person and scan the whole user list every time.

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. `teamIds` JSON column on `users` | One table | Rewrites user rows for team edits; hard to query "members of team" | S | |
| B. `teams` + `memberIds` JSON on team | Two reads | Concurrent edits clobber the array; user deletion rewrites JSON | S | |
| C. `teams` + `team_members` join table (`id = teamId_userId`) | Many-to-many, upserts can't duplicate (same trick as roster), cheap add/remove with batch helpers | Two tables | M | ✅ |

**Decision & rationale:** C. It matches the roster id pattern, uses `upsertRowsById` / `deleteRowsByIds`, and user deletion is a single `deleteRowsWhere`. Owner confirmed fields: name, description, colour, lead. Integrations: Roster filter, Tasks filter, assignee-picker team narrowing (task keeps one personal assignee).

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk | Status |
|---|---|---|---|---|
| 1 | Schema, loader, pure validation + helpers, unit tests | S | Low | ✅ |
| 2 | Server actions (create/update/delete) + user-deletion cleanup | S | Med (multi-step writes) | ✅ |
| 3 | `/teams` page: stats, toolbar, table/grid, drawer, delete dialog, sidebar | M | Low | ✅ |
| 4 | Team filter on Roster and Tasks; team selector in assignee picker | S | Low | ✅ |
| 4b | Redesign after owner review: cards (header, team lead band, members with Show all) as default view; two-step drawer (1 Team details → 2 Members, search-to-add, crown to set lead) | S | Low | ✅ |
| 5 | Docs, security review, browser pass | S | Low | ⬜ browser pass pending |

## 3. 🔬 Feature analysis
### 3.1 Acceptance criteria
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Given active users, when I create a team with a name, colour and ≥ 1 member, then it appears in the list and a toast names it | manual |
| AC-2 | Given a team name exists (any case), when I save another with that name, then "already exists" shows on the name field | unit `requires a unique name` |
| AC-3 | Given a person in team A, when I add them to team B, then they are in both | unit `a person can be in several teams` + manual |
| AC-4 | Given a lead, when I remove the lead from members, then lead resets to "No lead"; the server rejects a lead who isn't a member | unit `lead must be a member` + manual |
| AC-5 | Given an inactive user, they can't be added; an existing inactive member can stay | unit `members: …inactive…` |
| AC-6 | When I delete a team, its memberships are removed first, users untouched | manual + data check |
| AC-7 | When a user is deleted, their memberships go and `leadId` is cleared where they led | manual + data check |
| AC-8 | Roster: choosing a team shows only its members; `?team=` survives month navigation | manual |
| AC-9 | Tasks: choosing a team shows tasks whose assignee (or a subtask's) is a member | manual |
| AC-10 | Assignee picker: choosing a team narrows the list; saving stores only `assigneeId` | manual |
| AC-11 | Empty, error (banner), loading (skeleton) states on `/teams` | manual |

### 3.2 Data impact
New tables `teams` (`id,name,description,leadId,color,createdAt,updatedAt`) and `team_members` (`id,teamId,userId,addedAt`), created lazily by `ensureTab`; missing tabs read as empty. No change to existing tables. Rollback: delete the two tabs; nothing else references them.

### 3.3 Threat model — OWASP Top 10 (2021)
| Risk | Relevant? | Mitigation / evidence |
|---|---|---|
| A01 | Yes | `await requireSession()` first in `createTeam`/`updateTeam`/`deleteTeam`; `/teams` behind `proxy.ts` |
| A02 | No | No new secrets |
| A03 | Yes | Server `cleanTeamInput` + `validateTeam`; RAW writes; text rendered by React; colour hex-validated on write and sanitised on read (used in a CSS variable) |
| A04 | Yes | Members must exist and be active; lead must be a member; `id` type-checked; write order never leaves orphan memberships |
| A05 | Yes | Generic `fail()` messages; details to `console.error` |
| A06 | Yes | `npm audit --omit=dev`: 0 vulnerabilities |
| A07 | No | Auth unchanged |
| A08 | No | No new dependencies/scripts |
| A09 | Yes | Failures logged server-side, no secrets |
| A10 | No | No outbound fetch |

### 3.4 Laws of UX
| Law | Applied how |
|---|---|
| Hick | One primary action ("New team"); Edit/Delete in a kebab menu; only search + member filter |
| Fitts (>= 44px) | Member rows and selects use `--touch`; primary button top-right, full-width drawer on mobile |
| Jakob | Same anatomy as Users: stat cards → toolbar → table/grid → pagination; drawer for forms; confirm dialog for delete |
| Miller | 4 stat cards; 10 rows/page; avatar stack caps at 5 (+N) |
| Doherty (< 400ms) | 250ms debounced search, client-side filtering, pending button states, skeleton |
| Postel / Tesler / Peak-End | Trims/collapses spaces, dedupes members, auto colour preset; ids/timestamps generated; toasts name the team and member count |
| Von Restorff | Single filled accent button; red only on Delete |

### 3.5 Mobile-first (375px)
Table collapses to cards (`grid-mobile-only`), drawer full-width, member list scrolls inside the drawer, no horizontal page scroll. Team chips always show text next to the colour dot.

### 3.6 Out of scope
Per-team permissions, team-level task ownership, nested teams, team capacity summaries.

## 4. 🔨 Implementation checklist
- [x] Smallest diff; reused `ActionMenu`, `ConfirmDialog`, `Pagination`, `useToasts`, `useFocusTrap`, `Avatar`; extracted `ColorField` from Settings instead of duplicating
- [x] Server-side validation + generic error messages
- [x] Auth guard on every new action
- [x] Empty, loading, error states
- [x] No hardcoded data, `any`, `@ts-ignore`, secrets, stray logs
- [x] No new env vars

## 5. 📏 Verification gates
- [x] **Performance** — create: 2 tab checks + 2 reads + 2 writes; update: + 1 upsert + 1 delete batch; no per-row loops
- [x] **SEO** — private (layout `noindex`); `/teams` title "Teams · WorkForce Management"; one `h1`
- [x] **Quality** — `npm run verify` green (tsc, 25 tests, build)
- [x] **Constraints** — CLAUDE.md re-read; OWASP table complete; Laws of UX above

## 6. ✅ Validation
| AC | Evidence | Result |
|---|---|---|
| AC-2, AC-3, AC-4, AC-5 | `tests/teams.test.ts` | ✅ |
| AC-1, AC-6–AC-11 | Browser pass (needs a signed-in session) | ⬜ |

- [x] Unit tests added and passing
- [ ] Browser pass at 375px and desktop
- [ ] Stored data verified after create / edit / delete; test rows removed

## 7. 🌿 Git & 🚀 release
- [ ] Conventional Commit (`feat(teams): …`) after the browser pass
- [x] README + CLAUDE.md updated
- [ ] PR with screenshots

## 8. Sign-off
Reviewer: — · Date: — · Verdict: —
