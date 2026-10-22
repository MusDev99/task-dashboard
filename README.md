# WorkForce Management

A resource-management system for small and medium teams: **plan work capacity from the roster, then assign tasks by availability.** Built with Next.js (App Router), React 19, Tailwind CSS 4 and TypeScript. Data is kept in a managed data store with one table per entity.

> The original gamified quiz leaderboard is still available at `/leaderboard`. It reads the legacy `tasks` table (completed quizzes) and is separate from work tasks.

## Features

| Area | Route | What it does |
|---|---|---|
| **Dashboard** | `/` | **Daily Whereabouts** for any day: who is on which shift, who is on leave, who has no roster entry. Filter by name/ID/code and copy a plain-text summary for chat. Below it: the legacy leaderboard stats. |
| **Roster** | `/roster` | Month grid of every active person. Click or drag cells to assign a shift or leave, `+` above a date to assign everyone, **Clear schedule** to bulk-remove, **Export / Upload CSV**. One record per person per day. |
| **Tasks** | `/tasks` | **List Tree**, **Kanban** (drag between statuses) and **Calendar** views. Generated code (`TSK-0001`), story points with complexity, one assignee, labels, optional start/due dates, links (Jira, GitLab merge requests, GitHub or any URL), and one level of subtasks. The assignee picker shows roster availability for the task's dates and open workload; unavailable people get a warning but can still be assigned. |
| **Users** | `/users` | Admin table/grid with stats, search, filters (status, location), sorting, pagination, and add/edit/delete in a drawer. Deleting a user also removes their roster rows and unassigns their work tasks. |
| **Settings** | `/settings` | **Operational Settings** (no code changes needed): *General* (time zone, task code prefix, week start, max labels/links), *Work shifts*, *Leave types*, *Locations*, *Roles*, *Task statuses*, *Story points*. Items in use can't be deleted; deactivate them instead. |
| **Leaderboard** | `/leaderboard` | Legacy merit-score ranking. |

## Data store setup

1. Provision the data store and a service identity with read/write access to it; download its credentials JSON into `keys/` (git-ignored).
2. Copy `.env.example` to `.env` and set `DATA_STORE_ID` and `DATA_STORE_KEY_PATH` (path to the credentials JSON). On hosts without a file system (e.g. Netlify) set `DATA_STORE_CLIENT_EMAIL` + `DATA_STORE_PRIVATE_KEY` instead and leave `DATA_STORE_KEY_PATH` unset.
3. Seed sample data (creates/overwrites the `users` and `tasks` tables): `npm run seed:data`
4. Create the settings tables: `npm run migrate:settings` (see below).

### Tables

| Table | Purpose | Created |
|---|---|---|
| `users` | People (id, email, name, employeeId, locationId, roleId, …) | `seed:data` |
| `tasks` | Legacy quiz completions (leaderboard) | `seed:data` |
| `roster` | One row per user per day (`id = userId_YYYY-MM-DD`) | automatically on first roster edit |
| `work_tasks` | Tasks and subtasks (`parentId` set = subtask) | automatically on first task |
| `roster_codes` | Work shifts + leave types | `migrate:settings` or first Settings save |
| `locations`, `roles` | Managed lists used by users | `migrate:settings` or first Settings save |
| `task_statuses`, `story_points`, `app_settings` | Task workflow + general settings | `migrate:settings` or first Settings save |

Row 1 of every table is the header (columns are defined in `lib/schema.ts`). **Don't rename header cells by hand**: the app reports a clear error if a required column is missing. Reads are cached for ~15 seconds.

### Migrating older data (`npm run migrate:settings`)

Safe to re-run. It seeds the settings tables from `json/` if they're missing, backs up the `users` table as `users_backup_YYYYMMDD`, replaces the old `stationCode` column with `locationId` (creating a location for each distinct station code), and creates a role for each role id in use (rename them in **Settings → Roles**). Until it has run, the app shows a banner telling you to run it.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npx tsc --noEmit   # typecheck (ESLint config is currently broken)
```

## Deploying to Netlify

`netlify.toml` already runs `npm run build` with the Next.js plugin. In Netlify set:

- `DATA_STORE_ID`, `DATA_STORE_CLIENT_EMAIL` (the credentials file's `client_email`) and `DATA_STORE_PRIVATE_KEY` (its `private_key`), scoped to Functions.
- `NODE_VERSION=22`.
- **Don't** set `DATA_STORE_KEY_PATH` (the credentials file isn't deployed).

**Troubleshooting a failing deploy**

- A blank page saying *"Application error: a server-side exception has occurred"* with only a digest means the server threw before rendering. Open Netlify → **Logs → Functions**, find the failing request and read the first error line. Typical causes: `Missing environment variable DATA_STORE_PRIVATE_KEY` (not set, or not scoped to Functions), `…is not valid PEM` (the error says how long the pasted key is and whether the BEGIN/END lines were found; a complete key body is ~1,600 characters, so re-paste the whole `private_key` value), `Cannot read the credentials key at …` (`DATA_STORE_KEY_PATH` is set on Netlify — remove it), or a request failure with status `403`/`404` (the service identity lacks access, or `DATA_STORE_ID` is wrong).
- Credential or connectivity problems no longer crash pages: you'll normally see the page with a red *"Couldn't load …"* banner, and the exact reason in the function logs. Env-var changes only apply to **new deploys**: trigger a redeploy after editing them.

> ⚠️ The app has **no authentication yet**: anyone with the URL can view and edit everything. Protect the site (e.g. Netlify password protection) or add a login before sharing it.

## Project structure

- `app/` routes (feature code lives next to its route): `page.tsx` (dashboard), `roster/`, `tasks/`, `users/`, `settings/`, `whereabouts/`, `leaderboard/`
- `app/components/` shared UI (sidebar, `ui/` primitives: drawer helpers, menus, dialogs, toasts, pagination)
- `lib/` server logic: `store.ts` (data-store client), `actions.ts` (reads), `*-actions.ts` (server actions), `*-validation.ts`, `schema.ts`, `settings.ts` / `shifts.ts` / `task-config.ts` (settings readers), pure helpers (`capacity.ts`, `whereabouts.ts`, `links.ts`, `roster-dates.ts`)
- `json/` seed defaults only (settings live in the data store once migrated)
- `scripts/` one-off seed and migration scripts
- `.claude/skills/appsec-review/` security-review skill (`SKILL.md` checklist + `scan.sh` automated scan); `docs/` review reports
- `CLAUDE.md` project rules for contributors/AI (architecture, UX standard, definition of done)

## Security

Run the project's security-review skill before releases and after adding a server action, form, URL field, import or dependency: ask Claude Code to *"run the appsec-review skill"*, or run the automated part directly with `bash .claude/skills/appsec-review/scan.sh`. Reports are kept in `docs/` (latest: `docs/security-review-2026-10-22.md`).

## Changelog

- **Security review**: added the `appsec-review` skill and a first review report (`docs/security-review-2026-10-22.md`): top open items are no authentication, vulnerable dependencies and staff data in the repo.
- **Confidentiality**: the underlying data store is no longer named anywhere in the UI, messages or docs. Configuration variables are now `DATA_STORE_*` (the previous names still work), the seed script is `npm run seed:data`, and the client module is `lib/store.ts`.
- **Private key parsing**: `DATA_STORE_PRIVATE_KEY` is accepted however a hosting UI mangles it (real newlines, `\n`, doubled `\\n`, quotes, CRLF, newlines collapsed to spaces, or the whole credentials JSON pasted). Incomplete keys get an error that says what is wrong without printing the secret.
- **Resilience**: if the data store can't be reached or credentials are wrong, pages load with an error banner (and log the reason) instead of crashing with a server-side exception. Settings fall back to the built-in defaults meanwhile.
- **Operational Settings**: manage shifts, leave types, locations, roles, task statuses, story points and general options in the app. Location replaces the free-text station code on users; roles are a managed list. The legacy `/task` ("Completions") pages were removed.
- **Task Management**: `/tasks` with List Tree / Kanban / Calendar, subtasks, labels, links, story points and availability-aware assignment. App renamed to WorkForce Management.
- **Daily Whereabouts** on the dashboard.
- **Roster** with in-cell editing, bulk clear and CSV import/export.
- **Users** admin module (CRUD, filters, pagination).
- Moved from a local database to a hosted data store.
