# WorkForce Management

A resource-management system for small and medium teams: **plan work capacity from the roster, then assign tasks by availability.** Built with Next.js (App Router), React 19, Tailwind CSS 4 and TypeScript. **Google Sheets is the database** (one tab per table), so non-developers can also inspect the data.

> The original gamified quiz leaderboard is still available at `/leaderboard`. It reads the legacy `tasks` tab (completed quizzes) and is separate from work tasks.

## Features

| Area | Route | What it does |
|---|---|---|
| **Dashboard** | `/` | **Daily Whereabouts** for any day: who is on which shift, who is on leave, who has no roster entry. Filter by name/ID/code and copy a plain-text summary for chat. Below it: the legacy leaderboard stats. |
| **Roster** | `/roster` | Month grid of every active person. Click or drag cells to assign a shift or leave, `+` above a date to assign everyone, **Clear schedule** to bulk-remove, **Export / Upload CSV**. One record per person per day. |
| **Tasks** | `/tasks` | **List Tree**, **Kanban** (drag between statuses) and **Calendar** views. Generated code (`TSK-0001`), story points with complexity, one assignee, labels, optional start/due dates, links (Jira, GitLab merge requests, GitHub or any URL), and one level of subtasks. The assignee picker shows roster availability for the task's dates and open workload; unavailable people get a warning but can still be assigned. |
| **Users** | `/users` | Admin table/grid with stats, search, filters (status, location), sorting, pagination, and add/edit/delete in a drawer. Deleting a user also removes their roster rows and unassigns their work tasks. |
| **Settings** | `/settings` | **Operational Settings** (no code changes needed): *General* (time zone, task code prefix, week start, max labels/links), *Work shifts*, *Leave types*, *Locations*, *Roles*, *Task statuses*, *Story points*. Items in use can't be deleted; deactivate them instead. |
| **Leaderboard** | `/leaderboard` | Legacy merit-score ranking. |

## Google Sheets setup

1. Create a Google Cloud service account, enable the **Google Sheets API**, and download a JSON key into `keys/` (git-ignored).
2. Create a spreadsheet and share it with the service account's email as **Editor**.
3. Copy `.env.example` to `.env` and set `GOOGLE_SHEET_ID` and `GOOGLE_SHEET_PATH` (path to the JSON key). Where files aren't available (e.g. Netlify) set `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY` instead and leave `GOOGLE_SHEET_PATH` unset.
4. Seed sample data (creates/overwrites `users` and `tasks`): `npm run migrate:sheets`
5. Create the settings tabs: `npm run migrate:settings` (see below).

### Tabs

| Tab | Purpose | Created |
|---|---|---|
| `users` | People (id, email, name, employeeId, locationId, roleId, …) | `migrate:sheets` |
| `tasks` | Legacy quiz completions (leaderboard) | `migrate:sheets` |
| `roster` | One row per user per day (`id = userId_YYYY-MM-DD`) | automatically on first roster edit |
| `work_tasks` | Tasks and subtasks (`parentId` set = subtask) | automatically on first task |
| `roster_codes` | Work shifts + leave types | `migrate:settings` or first Settings save |
| `locations`, `roles` | Managed lists used by users | `migrate:settings` or first Settings save |
| `task_statuses`, `story_points`, `app_settings` | Task workflow + general settings | `migrate:settings` or first Settings save |

Row 1 of every tab is the header (columns are defined in `lib/schema.ts`). **Don't rename header cells by hand**: the app reports a clear error if a required column is missing. Edit rows in the sheet if you like; the site reads are cached for ~15 seconds.

### Migrating an older sheet (`npm run migrate:settings`)

Safe to re-run. It seeds the settings tabs from `json/` if they're missing, backs up the `users` tab as `users_backup_YYYYMMDD`, replaces the old `stationCode` column with `locationId` (creating a location for each distinct station code), and creates a role for each role id in use (rename them in **Settings → Roles**). Until it has run, the app shows a banner telling you to run it.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npx tsc --noEmit   # typecheck (ESLint config is currently broken)
npm test           # unit tests (node --test, Node 22+)
npm run verify     # typecheck + tests + build
npm run smoke -- <url>   # post-deploy auth/header checks
```

## Deploying to Netlify

`netlify.toml` already runs `npm run build` with the Next.js plugin. In Netlify set:

- `ADMIN_PASSWORD` and `AUTH_SECRET` (see Sign-in below; without them the site returns 503).
- `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` (the key file's `client_email`) and `GOOGLE_PRIVATE_KEY` (its `private_key`), scoped to Functions.
- `NODE_VERSION=22`.
- **Don't** set `GOOGLE_SHEET_PATH` (the key file isn't deployed).

**Troubleshooting a failing deploy**

- A blank page saying *"Application error: a server-side exception has occurred"* with only a digest means the server threw before rendering. Open Netlify → **Logs → Functions**, find the failing request and read the first error line. Typical causes: `Missing environment variable GOOGLE_PRIVATE_KEY` (not set, or not scoped to Functions), `…is not valid PEM` (key pasted incompletely), `Cannot read service-account key at …` (`GOOGLE_SHEET_PATH` is set on Netlify — remove it), or a Sheets API `403`/`404` (sheet not shared with the service account as Editor, or the wrong `GOOGLE_SHEET_ID`).
- Since the credentials/sheet problems above no longer crash pages, you'll normally see the page with a red *"Couldn't load … from Google Sheets"* banner instead, and the exact reason in the function logs. Env-var changes only apply to **new deploys**: trigger a redeploy after editing them.

### Sign-in & security (OWASP)

The whole app is private: every page except `/login` needs the team password. Set these in Netlify (Functions scope) or Vercel (Production **and** Preview):

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Team password (>= 8 chars) |
| `AUTH_SECRET` | Random signing key for the 8-hour session cookie (>= 16 chars, e.g. `openssl rand -base64 32`) |
| `AUTH_DISABLED=true` | Optional, only if the deploy is already behind SSO/VPN |

**Without `ADMIN_PASSWORD` + `AUTH_SECRET` a production build answers `503` by design (fail closed).** Locally (`npm run dev`) no password is needed. Also in place: security headers and CSP, `HttpOnly` + `SameSite=Lax` (+ `Secure` in prod) cookie, constant-time check, login throttle, `requireSession()` inside every server action, `noindex`. After deploying run `npm run smoke -- https://<your-url>` (all lines ✅). Security audit: `docs/audits/2026-10-24-audit.md`.

### AI-driven development workflow

`.claude/skills/` contains the pipeline **brainstorm -> plan -> feature analysis -> implement -> verify (performance, SEO, quality, constraints) -> validate (unit tests + `feature.md` checklist) -> git -> release**: `dev-workflow`, `feature-checklist`, `code-review-checklist`, `owasp-audit`, `release`. Per-feature files live in `docs/features/<slug>/feature.md`, reviews in `docs/reviews/`, audits in `docs/audits/`.

## Project structure

- `app/` routes (feature code lives next to its route): `page.tsx` (dashboard), `roster/`, `tasks/`, `users/`, `settings/`, `whereabouts/`, `leaderboard/`
- `app/components/` shared UI (sidebar, `ui/` primitives: drawer helpers, menus, dialogs, toasts, pagination)
- `lib/` server logic: `googleSheets.ts` (Sheets client), `actions.ts` (reads), `*-actions.ts` (server actions), `*-validation.ts`, `schema.ts`, `settings.ts` / `shifts.ts` / `task-config.ts` (settings readers), pure helpers (`capacity.ts`, `whereabouts.ts`, `links.ts`, `roster-dates.ts`)
- `json/` seed defaults only (settings live in the sheet once migrated)
- `proxy.ts` auth gate · `lib/auth-core.ts` / `lib/auth.ts` / `lib/auth-actions.ts` session logic · `app/login/`
- `scripts/` one-off migrations and `smoke.mjs`
- `tests/` unit tests · `docs/` features, reviews, audits · `.claude/skills/` AI dev workflow
- `CLAUDE.md` project rules for contributors/AI (architecture, UX standard, definition of done)

## Changelog

- **Security & workflow**: sign-in (`ADMIN_PASSWORD` + `AUTH_SECRET`; production fails closed with 503 until set), session guard in every server action, security headers/CSP, `npm audit fix` (6 -> 0 vulnerabilities, Next 16.4.3), `.gitignore`, unit tests, `npm run verify` / `smoke`, Claude skills for the AI-driven workflow, OWASP + mobile-first + git rules in CLAUDE.md.
- **Resilience**: if Google Sheets can't be reached or credentials are wrong, pages now load with an error banner (and log the reason) instead of crashing with a server-side exception. Settings fall back to the built-in defaults while the sheet is unreachable.
- **Operational Settings**: manage shifts, leave types, locations, roles, task statuses, story points and general options in the app. Location replaces the free-text station code on users; roles are a managed list. The legacy `/task` ("Completions") pages were removed.
- **Task Management**: `/tasks` with List Tree / Kanban / Calendar, subtasks, labels, links, story points and availability-aware assignment. App renamed to WorkForce Management.
- **Daily Whereabouts** on the dashboard.
- **Roster** with in-cell editing, bulk clear and CSV import/export.
- **Users** admin module (CRUD, filters, pagination).
- **Google Sheets** replaces Prisma/SQLite as the database.
