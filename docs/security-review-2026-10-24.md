# Security review — 2026-10-24 (Teams module)

Scope: `lib/team-actions.ts`, `lib/team-validation.ts`, `lib/teams.ts`, `loadTeams` in `lib/actions.ts`, user-deletion cleanup in `lib/user-actions.ts`, `app/teams/*`, team filters in `app/roster/*` and `app/tasks/*`.

Automated scan (`scan.sh`): new actions listed under section 1; no dangerous sinks; RAW writes only; `npm audit --omit=dev` 0 vulnerabilities; security headers present; no vendor strings in served pages.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | All three team actions call `await requireSession()` first | — | ✅ verified |
| 2 | Payload could be `null`/non-object and crash `cleanTeamInput` before the try block (500 instead of a clean error) | Low | Fixed: cleaner accepts any value |
| 3 | `id` argument not type-checked in `updateTeam`/`deleteTeam` | Low | Fixed: non-string/empty → "no longer exists" |
| 4 | Team colour is used as a CSS custom property; a hand-edited cell could carry `url(...)` | Low | Fixed: validated on write, sanitised to `#rrggbb` on read |
| 5 | Unknown/inactive member ids could be submitted | — | Rejected by `validateTeam` (members must exist; new members must be active) |
| 6 | Multi-step writes | — | Ordered: team → memberships on create; add → update → remove on edit; memberships → team on delete; memberships → lead cleanup → user on user delete |

No open High or Medium findings.
