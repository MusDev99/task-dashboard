# WorkForce Management — project rules for Claude

Resource-management system for small/medium teams: plan capacity from the **roster**, then assign **tasks** by availability. The legacy Leaderboard/merit score was removed; the `tasks` table (old quiz completions) is no longer read by the UI — only seeded and cleaned up when a user is deleted. Installable PWA, mobile-first. Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. Data lives in a managed data store (one table per entity).

## Commands
- `npm run dev` / `npm run build` — dev server / production build
- `npm run seed:data` — seeds the `users` and `tasks` tables from `json/` (**overwrites them**; also resets any CRUD changes; does not touch `roster` or settings tables)
- `npm run migrate:settings` — idempotent: seeds settings tables from `json/` if missing, backs up `users`, converts `stationCode` → `locationId`, creates roles from role ids in use
- `npx tsc --noEmit` — typecheck (ESLint config is currently broken; don't rely on `next lint`)
- `npm test` — unit tests (`node --test`, Node 22+) · `npm run verify` — typecheck + tests + build · `npm run smoke -- <url>` — post-deploy auth/header checks · `node scripts/e2e/sso.e2e.mjs` — SSO end-to-end with fake Google + data store (needs a build and Playwright)

## Data rules
- Tables: `users`, `roster`, `work_tasks`, settings tables (`roster_codes`, `locations`, `roles`, `task_statuses`, `story_points`, `app_settings`) + `teams`, `team_members` + legacy `tasks` = quiz completions. Row 1 = header. Column order is defined once in `lib/schema.ts`. Don't edit header cells by hand: readers fail loudly (`assertColumns`) if a required column is missing.
- All data access goes through `lib/store.ts` (`readTable`, `appendRow`, `updateRowById`, `upsertRowsById`, `deleteRowsWhere`, `deleteRowsByIds`, `ensureTab`, `writeTable`). Never call the data-store API elsewhere. Prefer the batch helpers for multi-row edits (few API calls, not N).
- Reads: `lib/actions.ts` (typed `User` / `TaskCompletion`; `loadDirectory()` reports load failures). Writes: server actions in `lib/*-actions.ts` (`"use server"`).
- **Validate on the server** (`lib/validation.ts`) — client validation is only for UX. Trim input, check uniqueness, never trust the client.
- Writes store values exactly as typed (no reinterpretation). Dates keep the stored format `YYYY-MM-DD HH:mm:ss.SSS` (UTC).
- **Roster:** one row per user per day, `id = "{userId}_{YYYY-MM-DD}"` (so upserts can't duplicate); an empty cell = no row. The `roster` tab is created lazily by `ensureTab`. Deleting a user also deletes their roster rows.
- **Shift/leave codes** (hours, colours, paid, active) live in the `roster_codes` table, read only through `lib/shifts.ts` (`getShiftConfig`); the org timezone comes from `app_settings`. `json/` files are only seed defaults used when a tab doesn't exist yet. Never hardcode codes, hours, colours or the timezone in components or actions.
- **Dashboard Whereabouts** (`/`, `app/whereabouts/`) is a derived, read-only view of `users` + `roster` for one day. All grouping/copy-text logic lives in `lib/whereabouts.ts` (pure, no data access); shift names/times/colours come from `getShiftConfig()`, never hardcoded. "Unscheduled" = active user with no roster row that day.
- **Teams** (`/teams`, `app/teams/`, tables `teams` + `team_members`): many-to-many join table, membership `id = "{teamId}_{userId}"`; both tabs created lazily by `ensureTab`. Pure logic in `lib/teams.ts` + `lib/team-validation.ts` (unit-tested), writes in `lib/team-actions.ts`. Names unique (case-insensitive), ≥ 1 member, lead must be a member, new members must be active. Deleting a team deletes its memberships first; deleting a user deletes their memberships and clears `leadId` where they led. Teams only **filter** (Roster, Tasks, assignee picker) — a task never stores a team.
- **Work tasks** (`/tasks`, `app/tasks/`, table `work_tasks`): tasks and subtasks share the table — `parentId` empty = task, set = subtask, **one level only**. One assignee per task/subtask. `code` is generated (`TSK-0001…`), never typed. `labels`/`links` are JSON-encoded arrays; `startDate`/`dueDate` optional `YYYY-MM-DD`. Deleting a task deletes its subtasks first; deleting a user **unassigns** their work tasks (keeps them).
- **Task config** (statuses with colour/open/default/done flags, story-point scale with complexity, code prefix, label/link limits, week start) lives in `task_statuses`, `story_points` and `app_settings`, read only via `lib/task-config.ts` (`getTaskConfig`). Use `defaultStatus()` / `doneStatus()` from `lib/task-status.ts` — never hardcode `"todo"`/`"completed"` or point values.
- **Operational Settings** (`/settings`, `app/settings/`, `lib/settings*.ts`): one generic `EntitySection` + `entities.tsx` field definitions per entity (shift, leave, location, role, status, point) plus a General form. Codes/keys/values are **immutable** after creation; in-use items can't be deleted (offer **Deactivate**); inactive items still render where used but can't be picked (pickers filter `active`). Exactly one default and one done status. Saves go through `lib/settings-actions.ts` (seeds a missing table from defaults first).
- **Failure handling**: read-only getters (`getShiftConfig`, `getTaskConfig`, `getLocations`, `getRoles`, `getAppSettings`) use `readSettingsTabSafe` — they log and fall back to defaults so a data-store/credentials outage shows an error banner instead of crashing the route. **Writers and seeding must use the strict `readSettingsTab`** (an outage must never be mistaken for "table missing" and seeded over real data). New pages must catch loader errors and render a banner, never throw to Next's generic 500.
- **Locations & roles**: users reference `locationId` / `roleId` (managed lists, replacing the old free-text station code / role id). Show names via `getLocations()` / `getRoles()`; never display raw ids. New code must not reintroduce `stationCode`.
- **Links** are http(s) only (`safeUrl` in `lib/links.ts`), rendered with `target="_blank" rel="noopener noreferrer"`; Jira/GitLab/GitHub detection is in `describeLink`.
- **Availability warns, never blocks**: `lib/capacity.ts` (pure) + `getAssigneeAvailability` compute working/leave/unscheduled days over the task window from the roster, plus open story points; the picker shows it and warns, but any active person can be assigned.
- Order multi-step writes so a failure never leaves dangling references (delete a user's `tasks` before the `users` row).
- After a mutation, `revalidatePath` every page that shows the data (`/users`, `/`, `/roster`, `/tasks`, `/teams`, `/settings`).
- **PWA**: manifest in `app/manifest.ts`, service worker `public/sw.js`. The SW may cache only content-hashed build assets (`/_next/static/*`) and `/icons/*` — **never pages, server-action responses or any data** (shared devices, private staff data); offline navigations get `public/offline.html`. Public static PWA files must stay excluded in the `proxy.ts` matcher. Bump `VERSION` in `sw.js` to evict old caches.
- **Roster views**: Day (`DayView.tsx`, default on phones) and Month (`RosterGrid.tsx`, default on desktop), chosen via `useSyncExternalStore` + `matchMedia` (server snapshot `null` → skeleton, never a hydration mismatch); `?view=` / `?day=` mirror the choice. Grid rows are memoised `RosterRow`s keyed on a joined code string — keep callbacks passed to the grid stable (`useCallback`) or every row re-renders. Day labels come from `app/roster/days.ts` (`monthDays`).
- Pages that read data export `dynamic = "force-dynamic"`.
- **No hardcoded data** in components — everything comes from the data store. `json/` is seed/default data for migrations and for tables that don't exist yet.
- Secrets: never read, print or commit `.env*` or `keys/`. Error messages must describe problems (lengths, found/missing markers) without echoing secret values. Credentials come from `DATA_STORE_ID` + `DATA_STORE_KEY_PATH` (credentials JSON), or on hosts without files `DATA_STORE_CLIENT_EMAIL` + `DATA_STORE_PRIVATE_KEY` (older variable names remain supported as fallbacks inside `lib/store.ts`). Document new variables in `.env.example`.
- **Authentication**: Google SSO (OIDC authorization code + PKCE, hand-rolled, no dependency). Only people with an **active row in the `users` tab** (matched by Google `sub` stored in `googleId`, else by email, case-insensitive) get a session; everyone else sees the "not registered — contact me on WhatsApp" banner on `/login` (`CONTACT_WHATSAPP`). Session cookie `wf_session` = HMAC-signed `{uid,email,exp}` (8h). `proxy.ts` redirects everything but `/login` and `/api/auth/*`; `lib/auth.ts` (`requireSession`, `currentUser`) guards every server action; pure logic is in `lib/auth-core.ts`, `lib/oidc.ts`, `lib/registration.ts` (unit-tested). The registration lookup uses the strict `readUsers()` (an outage is "unavailable", never "not registered"). Production without `AUTH_SECRET` + `GOOGLE_CLIENT_ID/SECRET` returns 503 (fail closed). To grant access, add the person to **Users**; to revoke, deactivate them (an existing session lasts at most 8h). No per-user roles yet.

## Code conventions
- Server components fetch; client components (`"use client"`) handle interaction. Keep the boundary narrow.
- Strict TypeScript: no `any`, no `@ts-ignore`. Fix the type instead.
- Reuse before adding: `app/components/ui/*` (`ActionMenu` portal menu, `Pagination`, `ConfirmDialog`, `Toast`/`useToasts`, `useFocusTrap` — stacked overlays: only the top-most trap handles keys, `useDismiss`, `Avatar`, `Icons`), `app/lib/ui.ts` (avatars, `displayName`), `app/lib/merit.ts` (legacy scoring). `app/users/*` and `app/tasks/*` are the reference admin implementations.
- Feature code lives next to its route (`app/<module>/`); cross-cutting logic in `lib/`.
- Stored names may end with `" -"`; always display via `displayName()`.

## UI / UX standard (admin pages)
**Anatomy, top to bottom:** page header (title + one primary action) → stat cards → toolbar (search, filters, view toggle) → data view (table and/or grid) → pagination. Empty, loading (skeleton) and error states are required, not optional.

**Laws of UX — apply and check each one:**
- **Fitts**: primary action is large and edge-anchored; touch targets ≥ 44px on mobile (`--touch`).
- **Hick**: few visible choices; secondary actions live in a row menu; limit filters to what people use.
- **Jakob**: use familiar admin patterns (table + sortable headers, kebab row menu, drawer for forms, confirm dialog for delete, numbered pagination).
- **Miller**: chunk data — default 10 rows/page (10/20/50), ≤ 4 stat cards.
- **Doherty**: respond < 400ms — debounce search (250ms), pending states on buttons, skeleton loaders, instant client-side filtering.
- **Von Restorff**: exactly one filled accent button per view; red is reserved for destructive actions.
- **Proximity / Common Region**: group related controls (toolbar, card regions, form field rows).
- **Postel**: be liberal in what you accept (trim, case-normalise), strict in what you store.
- **Tesler**: the system absorbs complexity — generate ids/dates, don't ask for them.
- **Peak-End**: finish every action with a clear outcome (toast naming what happened).
- **Aesthetic-Usability**: consistent tokens, spacing and radius; no one-off styles.

**Style**: dark theme, tokens only from `app/globals.css` (`--bg-*`, `--text-*`, `--accent-*`, `--radius-*`, `--danger`). Use the shared classes (`.btn`, `.btn-primary`, `.btn-danger`, `.icon-btn`, `.input`, `.field`, `.select`, `.data-table`, `.drawer`, `.modal`, `.toast`, `.badge`, `.stat-card`, `.filter-pill`, `.pagination`) — add new classes to `globals.css` rather than long inline `style` objects. No raw hex colours in components.

**Interaction**: forms open in a side drawer (add/edit), validate inline on blur + submit, focus the first invalid field, keep input on server error, confirm if closing with unsaved changes. Destructive actions need a confirm dialog that states exactly what will be removed; **Cancel is the default focus**. Table/filter/sort/page state is mirrored to the URL via `history.replaceState` (shareable, no server round-trip).

**Accessibility**: every input has a `<label>`; visible focus ring (`--focus-ring`); full keyboard support (Tab order, Esc closes overlays, focus trapped in dialogs and returned on close); `aria-sort` on sortable headers, `aria-pressed` on toggles, `aria-live` for toasts/result counts, `role="alert"` for errors; never rely on colour alone (status has text + dot). Respect `prefers-reduced-motion`.

**Grids (e.g. roster)**: sticky header + first column, drag/click to edit in place with an anchored picker, optimistic updates that roll back on failure (`useOptimistic`), keyboard parity (arrows, Enter, Delete, Esc), code chips always show text (not just colour).

**Responsive**: design for 375px as well as desktop. Tables collapse to cards below 768px, drawers go full-width, no horizontal page scroll. Layout switches are **CSS media queries, not JS width checks** (the app shell/sidebar renders correctly from the server). On phones: top bar + bottom tab bar (fixed, safe-area aware — `.main-content` pads for both), pickers become bottom sheets, secondary toolbar actions go into one `ActionMenu`.

**Performance (60fps)**: no `backdrop-filter` on scrolling content, no `transition: all` (list properties), memoise large lists by row with primitive props, compute per-month/per-day labels once, avoid reading tables a page doesn't display.

## Confidentiality rule (always)
**Never name or hint at the underlying data store / its vendor** in: UI text, error or toast messages shown to users, `README.md`, other docs, code comments, commit messages, PR descriptions, or replies to the user. Say "the data store" / "tables" / "the system". Don't put real service-account emails, project ids or ids of the store in tracked files (`.env.example` uses placeholders). Configuration variables are `DATA_STORE_*`; the seed script is `npm run seed:data`; all access goes through `lib/store.ts`. Unavoidable exceptions: that module's endpoint addresses and legacy variable fallbacks (server-only, never sent to the browser), the Google account id on users (`googleId`), **Google sign-in** (an identity provider, named by design: the button text, `GOOGLE_CLIENT_ID/SECRET`, the OAuth endpoints in `lib/oidc.ts`, `scripts/e2e/fake-google.cjs` and the setup steps in `README.md`), the avatar image host in `next.config.ts`, and the font loader.

## Security review rule
Run the `appsec-review` skill (`.claude/skills/appsec-review/`; automated part: `bash .claude/skills/appsec-review/scan.sh`) **before any release/deploy and whenever you add or change a server action, form field, URL/link/avatar input, CSV import, dependency or security-relevant config**. Every server action is a public endpoint — it must validate all input on the server and call `await requireSession()` first. Keep findings in `docs/security-review-<date>.md`; don't leave known High findings unmentioned in the final summary.

## Security — OWASP Top 10 (2021), mandatory
| Risk | Rule in this repo |
|---|---|
| A01 Access control | Everything except `/login` and `/api/auth/*` needs a session (`proxy.ts`); only registered, active `users` rows can sign in. **First line of every exported `"use server"` function: `await requireSession()`** (they are public POST endpoints). Redirect targets go through `safeNext()` |
| A02 Crypto | Secrets only in env (`AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_*`). Sessions are HMAC-signed, `HttpOnly`, `SameSite=Lax`, `Secure` in prod. OAuth uses `state` + `nonce` + PKCE and verifies the ID token signature, `iss`, `aud`, `exp`, `email_verified`. Never hand-roll other crypto |
| A03 Injection | Validate + trim on the server (`lib/validation.ts`); Data writes stay `RAW`; no `dangerouslySetInnerHTML`; links only via `safeUrl` |
| A04 Design | Fail closed: unconfigured production returns 503. `AUTH_DISABLED=true` is only for a deploy already behind SSO/VPN |
| A05 Misconfiguration | Headers/CSP live in `next.config.ts`; user-facing errors are generic (`fail()`), details go to `console.error` only. No debug output |
| A06 Components | `npm audit --omit=dev` before each release; `npm audit fix`, never `--force` without a test pass |
| A07 Auth | Constant-time signature compare, throttled OAuth start/callback, redirect only via `safeNext()`. Only the banner on `/login` (signed flash cookie, 5 min) reveals *why* sign-in was refused |
| A08 Integrity | Commit the lockfile; no new third-party script/CDN without adding it to the CSP deliberately |
| A09 Logging | Log failures server-side; never log passwords, tokens or keys |
| A10 SSRF | Server code fetches fixed Google hosts only (`googleEndpoints` in `lib/oidc.ts`); never a URL taken from the client |

## Mobile-first & Laws of UX
Design for **375px first**, then scale up (thumb-reachable primary action, drawers full-width, tables collapse to cards below 768px, no horizontal scroll). Apply the Laws of UX listed under *UI / UX standard* to every new or changed screen and name the law in the PR/feature.md.

## Claude-native workflow (skills in `.claude/skills/`)
Start every feature, fix or refactor with `/dev-workflow` (brainstorm -> plan -> analysis -> implement -> verify -> validate -> git -> release).
| Skill | Use it when | Writes |
|---|---|---|
| `dev-workflow` | starting any change | gates + `docs/features/<slug>/feature.md` |
| `feature-checklist` | creating/validating a feature | `docs/features/<slug>/feature.md` (from `feature.md` template) |
| `code-review-checklist` | before every PR | `docs/reviews/<branch>.md` (from `code-review.md`) |
| `owasp-audit` | auth/endpoint/dependency/header change, pre-release | `docs/audits/<date>-audit.md` (from `audit.md`) |
| `release` | commit, PR, version, deploy, rollback | tag + release notes |

Gate commands: `npm run verify` (tsc + tests + build) · `npm test` · `npm run smoke -- <url>` (post-deploy auth/header checks). Never mark work done while a gate is red; report real output.

## Git strategy
Never commit to `main`. Branches `feat/*`, `fix/*`, `chore/*`, `docs/*` (an agent session may be given a fixed branch: use it). Conventional Commits. Commit only when asked, after `npm run verify`. Docs travel with the code (README + this file). SemVer tags `vX.Y.Z`; details in the `release` skill.

## Documentation rule (always)
**Whenever you add a feature or change how a feature works, update `README.md` in the same change** — the features table, tab list, setup/migration/deploy steps, project structure and a one-line entry at the top of the Changelog. Update this file (`CLAUDE.md`) too if the change adds or alters a rule, tab, config location or convention. A change isn't done until the docs match the code.

## Definition of done
1. `npm run verify` passes (typecheck, tests, build).
2. Exercised in the browser at desktop and 375px, including empty / error / keyboard-only paths.
3. Stored data verified after create / edit / delete (remove only the test rows you added; don't re-run `seed:data` casually — it overwrites `users`/`tasks`).
4. No new hardcoded data, `any`, `@ts-ignore`, or secrets in the diff.
5. `README.md` (and `CLAUDE.md` if rules changed) updated for the change.
