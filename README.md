# WorkForce Management

A resource-management system for small and medium teams: **plan work capacity from the roster, then assign tasks by availability.** Built with Next.js (App Router), React 19, Tailwind CSS 4 and TypeScript. Data is kept in a managed data store with one table per entity.

**Installable (PWA), mobile-first.** On a phone, open the app and choose *Add to Home Screen* / *Install app*: it launches full-screen with a bottom tab bar (Home, Tasks, Roster, Users, Teams). The roster opens in a one-day list with a bottom-sheet picker; the month grid is one tap away.

## Features

| Area | Route | What it does |
|---|---|---|
| **Dashboard** | `/` | **Daily Whereabouts** for any day: who is on which shift, who is on leave, who has no roster entry. Filter by name/ID/code and copy a plain-text summary for chat. |
| **Roster** | `/roster` | Two views (choice kept in `?view=`): **Day** (default on phones) — swipeable day strip, every person as a large tap row, per-code head-count, tap a row to set the code in a bottom sheet, *Set for all shown*; **Month** (default on desktop) — grid of every active person, click or drag cells to assign a shift or leave, `+` above a date to assign everyone. **Clear schedule** to bulk-remove, **Export / Upload CSV** (in the ⋮ menu on phones). One record per person per day. |
| **Tasks** | `/tasks` | **List Tree**, **Kanban** (drag between statuses) and **Calendar** views (on phones: task cards, swipeable lanes and an agenda). Generated code (`TSK-0001`), story points with complexity, one assignee, labels, optional start/due dates, links (Jira, GitLab merge requests, GitHub or any URL), and one level of subtasks. The assignee picker shows roster availability for the task's dates and open workload; unavailable people get a warning but can still be assigned. |
| **Users** | `/users` | Admin table/grid (name, location, role, status, joined) with stats, search, filters (status, location), sorting, pagination, and add/edit/delete in a drawer. Deleting a user also removes their roster rows and unassigns their work tasks. |
| **Teams** | `/teams` | Group registered users into teams (name, description, colour, optional lead). A person can be in several teams. Cards (lead + members) or table with stats, search, member filter, sorting and pagination; add/edit in a two-step drawer (details → members, crown to pick the lead). Teams power the **team filter** on Roster and Tasks and narrow the task assignee picker (tasks still have one personal assignee, never a team). |
| **Settings** | `/settings` | **Operational Settings** (no code changes needed): *General* (time zone, task code prefix, week start, max labels/links), *Work shifts*, *Leave types*, *Locations*, *Roles*, *Task statuses*, *Story points*. Items in use can't be deleted; deactivate them instead. |

## Data store setup

1. Provision the data store and a service identity with read/write access to it; download its credentials JSON into `keys/` (git-ignored).
2. Copy `.env.example` to `.env` and set `DATA_STORE_ID` and `DATA_STORE_KEY_PATH` (path to the credentials JSON). On hosts without a file system (e.g. Netlify) set `DATA_STORE_CLIENT_EMAIL` + `DATA_STORE_PRIVATE_KEY` instead and leave `DATA_STORE_KEY_PATH` unset.
3. Seed sample data (creates/overwrites the `users` and `tasks` tables): `npm run seed:data`
4. Create the settings tables: `npm run migrate:settings` (see below).

### Tables

| Table | Purpose | Created |
|---|---|---|
| `users` | People (id, email, name, employeeId, locationId, roleId, …) | `seed:data` |
| `tasks` | Legacy quiz completions (no longer shown; rows are still removed when a user is deleted) | `seed:data` |
| `roster` | One row per user per day (`id = userId_YYYY-MM-DD`) | automatically on first roster edit |
| `work_tasks` | Tasks and subtasks (`parentId` set = subtask) | automatically on first task |
| `teams` | Teams (id, name, description, leadId, color) | automatically on first team |
| `team_members` | One row per team member (`id = teamId_userId`) | automatically on first team |
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
npm test           # unit tests (node --test, Node 22+)
npm run verify     # typecheck + tests + build
npm run smoke -- <url>   # post-deploy auth/header checks
```

## Deploying to Netlify

`netlify.toml` already runs `npm run build` with the Next.js plugin. In Netlify set:

- `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `CONTACT_WHATSAPP` (see Sign-in below; without the first three the site returns 503).
- `DATA_STORE_ID`, `DATA_STORE_CLIENT_EMAIL` (the credentials file's `client_email`) and `DATA_STORE_PRIVATE_KEY` (its `private_key`), scoped to Functions.
- `NODE_VERSION=22`.
- **Don't** set `DATA_STORE_KEY_PATH` (the credentials file isn't deployed).

**Troubleshooting a failing deploy**

- A blank page saying *"Application error: a server-side exception has occurred"* with only a digest means the server threw before rendering. Open Netlify → **Logs → Functions**, find the failing request and read the first error line. Typical causes: `Missing environment variable DATA_STORE_PRIVATE_KEY` (not set, or not scoped to Functions), `…is not valid PEM` (the error says how long the pasted key is and whether the BEGIN/END lines were found; a complete key body is ~1,600 characters, so re-paste the whole `private_key` value), `Cannot read the credentials key at …` (`DATA_STORE_KEY_PATH` is set on Netlify — remove it), or a request failure with status `403`/`404` (the service identity lacks access, or `DATA_STORE_ID` is wrong).
- Credential or connectivity problems no longer crash pages: you'll normally see the page with a red *"Couldn't load …"* banner, and the exact reason in the function logs. Env-var changes only apply to **new deploys**: trigger a redeploy after editing them.

### Sign-in with Google (SSO) & security (OWASP)

The whole app is private. Every page except `/login` needs a Google sign-in, and only people with an **active row in the Users table** (matched by Google account, else by email) get in. Anyone else sees a banner *"<email> isn't registered. Ask the admin to add you"* with a **Contact me on WhatsApp** button. To grant access, add the person under **Users**; to revoke, deactivate them (an open session ends within 8 hours).

**One-time Google setup:** Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* (Web application) → add the authorized redirect URI `https://<your-site>/api/auth/google/callback` (and `http://localhost:3000/api/auth/google/callback` for local testing). Then set these in Netlify (Functions scope) or Vercel (Production **and** Preview):

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The OAuth client above |
| `APP_URL` | Public origin, e.g. `https://your-site.netlify.app` (no trailing slash) |
| `AUTH_SECRET` | Random signing key for the cookies (>= 16 chars, e.g. `openssl rand -base64 32`) |
| `CONTACT_WHATSAPP` | Your number, digits only with country code (e.g. `60123456789`), for the banner button |
| `GOOGLE_ALLOWED_DOMAIN` | Optional, e.g. `airasia.com`: only accept that Google Workspace domain |
| `AUTH_DISABLED=true` | Optional, only if the deploy is already behind SSO/VPN |
| ~~`ADMIN_PASSWORD`~~ | No longer used: remove it |

**Without `AUTH_SECRET` + `GOOGLE_CLIENT_ID/SECRET` a production build answers `503` by design (fail closed).** Locally (`npm run dev`) sign-in is off until you set them. Each deploy-preview origin needs its own redirect URI in Google, or test on the main site URL. Also in place: OAuth `state` + `nonce` + PKCE with full ID-token verification, security headers and CSP, `HttpOnly` + `SameSite=Lax` (+ `Secure` in prod) cookie, throttled sign-in start/callback, `requireSession()` inside every server action, `noindex`. If a person's row already has a different `googleId`, they are treated as not registered (clear the cell to re-bind). After deploying run `npm run smoke -- https://<your-url>` (all lines ✅). Tests: `npm test` and `node scripts/e2e/sso.e2e.mjs` (fake Google + data store). Security audit: `docs/audits/2026-10-24-audit.md`.

### AI-driven development workflow

`.claude/skills/` contains the pipeline **brainstorm -> plan -> feature analysis -> implement -> verify (performance, SEO, quality, constraints) -> validate (unit tests + `feature.md` checklist) -> git -> release**: `dev-workflow`, `feature-checklist`, `code-review-checklist`, `owasp-audit`, `release`. Per-feature files live in `docs/features/<slug>/feature.md`, reviews in `docs/reviews/`, audits in `docs/audits/`.

## Project structure

- `app/` routes (feature code lives next to its route): `page.tsx` (dashboard), `roster/`, `tasks/`, `users/`, `teams/`, `settings/`, `whereabouts/`, `manifest.ts` (PWA manifest)
- `public/sw.js` service worker (caches build assets + icons only), `public/offline.html`, `public/icons/` app icons
- `app/components/` shared UI (sidebar + mobile top bar/bottom tabs, `ServiceWorker.tsx` registration, `ui/` primitives: drawer helpers, menus, dialogs, toasts, pagination)
- `lib/` server logic: `store.ts` (data-store client), `actions.ts` (reads), `*-actions.ts` (server actions), `*-validation.ts`, `schema.ts`, `settings.ts` / `shifts.ts` / `task-config.ts` (settings readers), pure helpers (`teams.ts`, `team-validation.ts`, `capacity.ts`, `whereabouts.ts`, `links.ts`, `roster-dates.ts`)
- `json/` seed defaults only (settings live in the data store once migrated)
- `scripts/` one-off seed and migration scripts
- `.claude/skills/appsec-review/` security-review skill (`SKILL.md` checklist + `scan.sh` automated scan); `docs/` review reports
- `proxy.ts` auth gate · `lib/auth-core.ts` / `lib/oidc.ts` / `lib/registration.ts` (pure, tested) · `lib/auth.ts` / `lib/auth-actions.ts` · `app/api/auth/google/` (start + callback) · `app/login/`
- `tests/` unit tests · `docs/` features, reviews, audits · `.claude/skills/` AI dev workflow
- `CLAUDE.md` project rules for contributors/AI (architecture, UX standard, definition of done)

## Security

Run the project's security-review skill before releases and after adding a server action, form, URL field, import or dependency: ask Claude Code to *"run the appsec-review skill"*, or run the automated part directly with `bash .claude/skills/appsec-review/scan.sh`. Reports are kept in `docs/` (latest: `docs/security-review-2026-10-24.md`).

## Progressive Web App

| Piece | Where | Notes |
|---|---|---|
| Manifest | `app/manifest.ts` → `/manifest.webmanifest` | name, icons (192/512 + maskable + SVG), standalone, theme colour, Roster/Tasks shortcuts |
| Service worker | `public/sw.js` (registered in production only, when the page is idle) | cache-first for `/_next/static/*` and `/icons/*`; **pages and server actions are never cached** (private staff data) — offline navigations show `public/offline.html` |
| Public files | `proxy.ts` matcher | manifest, `sw.js`, `offline.html` and `icons/` are served without a session |
| Headers | `next.config.ts` | `sw.js` is `no-cache` (updates roll out on next visit); CSP adds `worker-src 'self'` and `manifest-src 'self'` |

To ship a service-worker change that must evict old caches, bump `VERSION` in `public/sw.js`.

## Changelog

- **v0.4.0 · Mobile-first for every module**: drawers and dialogs now sit above the phone top bar/tab bar (the Save button was hidden before); Tasks — list rows become cards, Kanban lanes swipe one per screen, Calendar becomes an agenda (with *Show earlier days*), filters fold into a *Filters · n* toggle; Users/Teams/Tasks primary action is a floating button above the tab bar; stat cards become a swipeable strip; confirm dialogs are bottom sheets; drawers are full-screen with safe-area footers; 16px inputs (no iOS zoom); shared `StatCard` replaces two duplicate card components.

- **v0.3.0 · PWA, mobile-first roster, leaderboard removed**: installable app (manifest, icons, service worker, offline page); CSS-only responsive shell (no hydration flash) with a bottom tab bar on phones; roster **Day view** with swipeable day strip and bottom-sheet picker, secondary actions in a ⋮ menu; the leaderboard, merit score and quiz-history UI are gone (`/leaderboard` → 404; Users show role instead of score; the user page is a profile); performance: memoised roster rows (editing/dragging re-renders one row, not the grid), month day labels computed once, Users/Profile/Dashboard no longer read the legacy `tasks` table, no `backdrop-filter`/`transition: all` on cards, ~5 KB of dead CSS removed.

- **v0.2.0 · Teams**: new `/teams` module to create teams from registered users (many teams per person, optional lead, colour), plus a team filter on Roster and Tasks and a team selector in the task assignee picker. New tables `teams` and `team_members` are created on first use; deleting a user removes their memberships.
- **Login redesign**: split-screen sign-in (brand and three feature points on desktop, compact on mobile) with a Google-branded button, "Redirecting…" feedback, and refusal/error banners kept inside the card.
- **Google SSO**: sign in with Google; only active rows in the Users tablele get in, others see a "contact me on WhatsApp" banner. Replaces the shared password (`ADMIN_PASSWORD` is gone; new env vars `GOOGLE_CLIENT_ID/SECRET`, `APP_URL`, `CONTACT_WHATSAPP`). Everyone signs in again once after deploy.
- **Security & workflow**: sign-in (production fails closed with 503 until configured), session guard in every server action, security headers/CSP, `npm audit fix` (6 -> 0 vulnerabilities, Next 16.4.3), `.gitignore`, unit tests, `npm run verify` / `smoke`, Claude skills for the AI-driven workflow, OWASP + mobile-first + git rules in CLAUDE.md.
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
