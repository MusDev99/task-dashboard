# WorkForce Management — project rules for Claude

Resource-management system for small/medium teams: plan capacity from the **roster**, then assign **tasks** by availability. Legacy gamified pieces (Leaderboard, merit score, `/task` "Completions" backed by the `tasks` tab) are kept working but separate — don't mix them with work tasks. Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. **Google Sheets is the database** (one tab = one table).

## Commands
- `npm run dev` / `npm run build` — dev server / production build
- `npm run migrate:sheets` — seeds the `users` and `tasks` tabs from `json/` (**overwrites the tabs**; also resets any CRUD changes; does not touch `roster`)
- `npx tsc --noEmit` — typecheck (ESLint config is currently broken; don't rely on `next lint`)

## Data rules
- Tabs: `users`, `roster`, `work_tasks` (+ legacy `tasks` = quiz completions). Row 1 = header. Column order is defined once in `lib/schema.ts`. Don't edit header cells by hand: readers fail loudly (`assertColumns`) if a required column is missing.
- All sheet access goes through `lib/googleSheets.ts` (`readTable`, `appendRow`, `updateRowById`, `upsertRowsById`, `deleteRowsWhere`, `deleteRowsByIds`, `ensureTab`, `writeTable`). Never call the Sheets API elsewhere. Prefer the batch helpers for multi-row edits (few API calls, not N).
- Reads: `lib/actions.ts` (typed `User` / `TaskCompletion`; `loadDirectory()` reports load failures). Writes: server actions in `lib/*-actions.ts` (`"use server"`).
- **Validate on the server** (`lib/validation.ts`) — client validation is only for UX. Trim input, check uniqueness, never trust the client.
- Writes use `valueInputOption=RAW`. Dates keep the sheet format `YYYY-MM-DD HH:mm:ss.SSS` (UTC).
- **Roster:** one row per user per day, `id = "{userId}_{YYYY-MM-DD}"` (so upserts can't duplicate); an empty cell = no row. The `roster` tab is created lazily by `ensureTab`. Deleting a user also deletes their roster rows.
- **Shift/leave codes** (STD, PH, AL, MC, hours, colours) live in `json/shifts.json` and are read only through `lib/shifts.ts` (`getShiftConfig`) — later this moves to a sheet tab by changing that one function. Never hardcode codes, hours or colours in components or actions.
- **Dashboard Whereabouts** (`/`, `app/whereabouts/`) is a derived, read-only view of `users` + `roster` for one day. All grouping/copy-text logic lives in `lib/whereabouts.ts` (pure, no sheet access); shift names/times/colours come from `getShiftConfig()`, never hardcoded. "Unscheduled" = active user with no roster row that day.
- **Work tasks** (`/tasks`, `app/tasks/`, tab `work_tasks`): tasks and subtasks share the tab — `parentId` empty = task, set = subtask, **one level only**. One assignee per task/subtask. `code` is generated (`TSK-0001…`), never typed. `labels`/`links` are JSON-encoded arrays; `startDate`/`dueDate` optional `YYYY-MM-DD`. Deleting a task deletes its subtasks first; deleting a user **unassigns** their work tasks (keeps them).
- **Task config** (statuses + colours + which count as open, story-point scale with complexity XS…XXL, limits) lives in `json/task-config.json`, read only via `lib/task-config.ts` (`getTaskConfig`). Never hardcode statuses or points.
- **Links** are http(s) only (`safeUrl` in `lib/links.ts`), rendered with `target="_blank" rel="noopener noreferrer"`; Jira/GitLab/GitHub detection is in `describeLink`.
- **Availability warns, never blocks**: `lib/capacity.ts` (pure) + `getAssigneeAvailability` compute working/leave/unscheduled days over the task window from the roster, plus open story points; the picker shows it and warns, but any active person can be assigned.
- Order multi-step writes so a failure never leaves dangling references (delete a user's `tasks` before the `users` row).
- After a mutation, `revalidatePath` every page that shows the data (`/users`, `/`, `/leaderboard`, `/task`, `/roster`, `/tasks`).
- Pages that read the sheet export `dynamic = "force-dynamic"`.
- **No hardcoded data** in components — everything comes from the sheet. `json/` is seed data for the migration only.
- Secrets: never read, print or commit `.env*` or `keys/`. Credentials come from `GOOGLE_SHEET_ID` + `GOOGLE_SHEET_PATH` (service-account JSON), fallback `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`. Document new variables in `.env.example`.
- The app has **no authentication yet**: server actions are callable by anyone who can reach the site. Don't deploy admin features publicly without adding an auth guard.

## Code conventions
- Server components fetch; client components (`"use client"`) handle interaction. Keep the boundary narrow.
- Strict TypeScript: no `any`, no `@ts-ignore`. Fix the type instead.
- Reuse before adding: `app/components/ui/*` (`ActionMenu` portal menu, `Pagination`, `ConfirmDialog`, `Toast`/`useToasts`, `useFocusTrap` — stacked overlays: only the top-most trap handles keys, `useDismiss`, `Avatar`, `Icons`), `app/lib/ui.ts` (avatars, `displayName`), `app/lib/merit.ts` (legacy scoring). `app/users/*` and `app/tasks/*` are the reference admin implementations.
- Feature code lives next to its route (`app/<module>/`); cross-cutting logic in `lib/`.
- Names in the sheet may end with `" -"`; always display via `displayName()`.

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

## Definition of done
1. `npx tsc --noEmit` and `npm run build` pass.
2. Exercised in the browser at desktop and 375px, including empty / error / keyboard-only paths.
3. Sheet data verified after create / edit / delete (then restore with `npm run migrate:sheets` if test data was changed).
4. No new hardcoded data, `any`, `@ts-ignore`, or secrets in the diff.
