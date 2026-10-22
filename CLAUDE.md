# WorkForce Management — project rules for Claude

Resource-management system for small/medium teams: plan capacity from the **roster**, then assign **tasks** by availability. The legacy Leaderboard + merit score (backed by the `tasks` table) still works but is separate from work tasks; the old `/task` "Completions" pages were removed. Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. Data lives in a managed data store (one table per entity).

## Commands
- `npm run dev` / `npm run build` — dev server / production build
- `npm run seed:data` — seeds the `users` and `tasks` tables from `json/` (**overwrites them**; also resets any CRUD changes; does not touch `roster` or settings tables)
- `npm run migrate:settings` — idempotent: seeds settings tables from `json/` if missing, backs up `users`, converts `stationCode` → `locationId`, creates roles from role ids in use
- `npx tsc --noEmit` — typecheck (ESLint config is currently broken; don't rely on `next lint`)

## Data rules
- Tables: `users`, `roster`, `work_tasks`, settings tables (`roster_codes`, `locations`, `roles`, `task_statuses`, `story_points`, `app_settings`) + legacy `tasks` = quiz completions. Row 1 = header. Column order is defined once in `lib/schema.ts`. Don't edit header cells by hand: readers fail loudly (`assertColumns`) if a required column is missing.
- All data access goes through `lib/store.ts` (`readTable`, `appendRow`, `updateRowById`, `upsertRowsById`, `deleteRowsWhere`, `deleteRowsByIds`, `ensureTab`, `writeTable`). Never call the data-store API elsewhere. Prefer the batch helpers for multi-row edits (few API calls, not N).
- Reads: `lib/actions.ts` (typed `User` / `TaskCompletion`; `loadDirectory()` reports load failures). Writes: server actions in `lib/*-actions.ts` (`"use server"`).
- **Validate on the server** (`lib/validation.ts`) — client validation is only for UX. Trim input, check uniqueness, never trust the client.
- Writes store values exactly as typed (no reinterpretation). Dates keep the stored format `YYYY-MM-DD HH:mm:ss.SSS` (UTC).
- **Roster:** one row per user per day, `id = "{userId}_{YYYY-MM-DD}"` (so upserts can't duplicate); an empty cell = no row. The `roster` tab is created lazily by `ensureTab`. Deleting a user also deletes their roster rows.
- **Shift/leave codes** (hours, colours, paid, active) live in the `roster_codes` table, read only through `lib/shifts.ts` (`getShiftConfig`); the org timezone comes from `app_settings`. `json/` files are only seed defaults used when a tab doesn't exist yet. Never hardcode codes, hours, colours or the timezone in components or actions.
- **Dashboard Whereabouts** (`/`, `app/whereabouts/`) is a derived, read-only view of `users` + `roster` for one day. All grouping/copy-text logic lives in `lib/whereabouts.ts` (pure, no data access); shift names/times/colours come from `getShiftConfig()`, never hardcoded. "Unscheduled" = active user with no roster row that day.
- **Work tasks** (`/tasks`, `app/tasks/`, table `work_tasks`): tasks and subtasks share the table — `parentId` empty = task, set = subtask, **one level only**. One assignee per task/subtask. `code` is generated (`TSK-0001…`), never typed. `labels`/`links` are JSON-encoded arrays; `startDate`/`dueDate` optional `YYYY-MM-DD`. Deleting a task deletes its subtasks first; deleting a user **unassigns** their work tasks (keeps them).
- **Task config** (statuses with colour/open/default/done flags, story-point scale with complexity, code prefix, label/link limits, week start) lives in `task_statuses`, `story_points` and `app_settings`, read only via `lib/task-config.ts` (`getTaskConfig`). Use `defaultStatus()` / `doneStatus()` from `lib/task-status.ts` — never hardcode `"todo"`/`"completed"` or point values.
- **Operational Settings** (`/settings`, `app/settings/`, `lib/settings*.ts`): one generic `EntitySection` + `entities.tsx` field definitions per entity (shift, leave, location, role, status, point) plus a General form. Codes/keys/values are **immutable** after creation; in-use items can't be deleted (offer **Deactivate**); inactive items still render where used but can't be picked (pickers filter `active`). Exactly one default and one done status. Saves go through `lib/settings-actions.ts` (seeds a missing table from defaults first).
- **Failure handling**: read-only getters (`getShiftConfig`, `getTaskConfig`, `getLocations`, `getRoles`, `getAppSettings`) use `readSettingsTabSafe` — they log and fall back to defaults so a data-store/credentials outage shows an error banner instead of crashing the route. **Writers and seeding must use the strict `readSettingsTab`** (an outage must never be mistaken for "table missing" and seeded over real data). New pages must catch loader errors and render a banner, never throw to Next's generic 500.
- **Locations & roles**: users reference `locationId` / `roleId` (managed lists, replacing the old free-text station code / role id). Show names via `getLocations()` / `getRoles()`; never display raw ids. New code must not reintroduce `stationCode`.
- **Links** are http(s) only (`safeUrl` in `lib/links.ts`), rendered with `target="_blank" rel="noopener noreferrer"`; Jira/GitLab/GitHub detection is in `describeLink`.
- **Availability warns, never blocks**: `lib/capacity.ts` (pure) + `getAssigneeAvailability` compute working/leave/unscheduled days over the task window from the roster, plus open story points; the picker shows it and warns, but any active person can be assigned.
- Order multi-step writes so a failure never leaves dangling references (delete a user's `tasks` before the `users` row).
- After a mutation, `revalidatePath` every page that shows the data (`/users`, `/`, `/leaderboard`, `/roster`, `/tasks`, `/settings`).
- Pages that read data export `dynamic = "force-dynamic"`.
- **No hardcoded data** in components — everything comes from the data store. `json/` is seed/default data for migrations and for tables that don't exist yet.
- Secrets: never read, print or commit `.env*` or `keys/`. Error messages must describe problems (lengths, found/missing markers) without echoing secret values. Credentials come from `DATA_STORE_ID` + `DATA_STORE_KEY_PATH` (credentials JSON), or on hosts without files `DATA_STORE_CLIENT_EMAIL` + `DATA_STORE_PRIVATE_KEY` (older variable names remain supported as fallbacks inside `lib/store.ts`). Document new variables in `.env.example`.
- The app has **no authentication yet**: server actions are callable by anyone who can reach the site. Don't deploy admin features publicly without adding an auth guard.

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

**Responsive**: design for 375px as well as desktop. Tables collapse to cards below 768px, drawers go full-width, no horizontal page scroll.

## Confidentiality rule (always)
**Never name or hint at the underlying data store / its vendor** in: UI text, error or toast messages shown to users, `README.md`, other docs, code comments, commit messages, PR descriptions, or replies to the user. Say "the data store" / "tables" / "the system". Don't put real service-account emails, project ids or ids of the store in tracked files (`.env.example` uses placeholders). Configuration variables are `DATA_STORE_*`; the seed script is `npm run seed:data`; all access goes through `lib/store.ts`. Unavoidable exceptions: that module's endpoint addresses and legacy variable fallbacks (server-only, never sent to the browser), the Google account id on users (`googleId`), the avatar image host in `next.config.ts`, and the font loader.

## Security review rule
Run the `appsec-review` skill (`.claude/skills/appsec-review/`; automated part: `bash .claude/skills/appsec-review/scan.sh`) **before any release/deploy and whenever you add or change a server action, form field, URL/link/avatar input, CSV import, dependency or security-relevant config**. Every server action is a public endpoint — it must validate all input on the server and (once authentication exists) call the authorization guard first. Keep findings in `docs/security-review-<date>.md`; don't leave known High findings unmentioned in the final summary.

## Documentation rule (always)
**Whenever you add a feature or change how a feature works, update `README.md` in the same change** — the features table, tab list, setup/migration/deploy steps, project structure and a one-line entry at the top of the Changelog. Update this file (`CLAUDE.md`) too if the change adds or alters a rule, tab, config location or convention. A change isn't done until the docs match the code.

## Definition of done
1. `npx tsc --noEmit` and `npm run build` pass.
2. Exercised in the browser at desktop and 375px, including empty / error / keyboard-only paths.
3. Stored data verified after create / edit / delete (remove only the test rows you added; don't re-run `seed:data` casually — it overwrites `users`/`tasks`).
4. No new hardcoded data, `any`, `@ts-ignore`, or secrets in the diff.
5. `README.md` (and `CLAUDE.md` if rules changed) updated for the change.
