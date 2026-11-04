# WorkForce Management

A resource-management system for small and medium teams: **plan work capacity from the roster, then assign tasks by availability.** Built with Next.js (App Router), React 19, Tailwind CSS 4 and TypeScript. Data is kept in a managed data store with one table per entity.

**Installable (PWA), mobile-first.** On a phone, open the app and choose *Add to Home Screen* / *Install app*: it launches full-screen with a bottom tab bar (Home, Tasks, Roster, Users, Teams). The roster opens in a one-day list with a bottom-sheet picker; the month grid is one tap away.

## Features

| Area | Route | What it does |
|---|---|---|
| **My schedule** | `/me` | Your own next 14 days (shift and times, leave, not scheduled; grouped by week, with working days and hours) and your open tasks and subtasks, overdue first, with a status select. Members land here after signing in. |
| **Dashboard** | `/` | **Daily Whereabouts** for any day: who is on which shift, who is on leave, who has no roster entry. Filter by name/ID/code and copy a plain-text summary for chat. |
| **Roster** | `/roster` | Two views (choice kept in `?view=`): **Day** (default on phones) — swipeable day strip, every person as a large tap row, per-code head-count, tap a row to set the code in a bottom sheet, *Set for all shown*; **Month** (default on desktop) — grid of every active person, click or drag cells to assign a shift or leave, `+` above a date to assign everyone. A collapsible **Coverage & rules** panel lists days below their coverage target and people past a rest/hours rule (warnings only). **Clear schedule** to bulk-remove, **Export / Upload CSV** (in the ⋮ menu on phones). One record per person per day. |
| **Tasks** | `/tasks` | **List Tree**, **Kanban** (drag between statuses) and **Calendar** views (on phones: task cards, swipeable lanes and an agenda). Generated code (`TSK-0001`), story points with complexity, one assignee, labels, optional start/due dates, links (Jira, GitLab merge requests, GitHub or any URL), and one level of subtasks. The assignee picker shows roster availability for the task's dates and open workload; unavailable people get a warning but can still be assigned. **Smart assign (AI pilot)** in the task drawer suggests up to 3 people with reasons (roster availability, open workload, past tasks); Claude re-ranks and explains when `ANTHROPIC_API_KEY` is set, otherwise rules answer. It only suggests: you press *Assign*. |
| **Users** | `/users` | Admin table/grid (name, location, role, status, joined) with stats, search, filters (status, location), sorting, pagination, and add/edit/delete in a drawer, including each person's **Access level** (Admin, Planner, Lead, Member). Deleting a user also removes their roster rows and unassigns their work tasks. |
| **Teams** | `/teams` | Group registered users into teams (name, description, colour, optional lead). A person can be in several teams. Cards (lead + members) or table with stats, search, member filter, sorting and pagination; add/edit in a two-step drawer (details → members, crown to pick the lead). Teams power the **team filter** on Roster and Tasks and narrow the task assignee picker (tasks still have one personal assignee, never a team). |
| **Leave** | `/leave` | Everyone can **request leave** for themselves (type, dates, note); requests start *Pending* and can be cancelled until decided. Admins and planners approve or reject any request; leads only for people in teams they lead (never their own). **Approving writes the leave code into the roster for every day** (replacing a shift already there, and says how many); rejecting can include a reason. Overlapping, past or over-62-day requests are refused. **Approved leave can be taken back** (the requester cancels their own; anyone who could decide it can revoke): from today on, only roster days that still hold that leave code are cleared, a day a planner has since changed is left alone, and days already gone stay as history. Leave not yet started becomes *Revoked*; leave under way is shortened to end yesterday. The other side is notified. |
| **Notifications** | `/notifications` | In-app inbox with an unread badge (menu on desktop, bell in the phone top bar; refreshed on load, on focus and every minute). You are told when someone **requests leave** (admins, planners, and the lead of the requester's teams), when **your leave is decided** (with the reason), and when a **task is assigned to you**. Open one to jump to its page; *Mark all as read* tidies old ones. You only ever see your own; you are never notified about your own action. |
| **Audit log** | `/audit` | Admin-only, read-only history of who changed what (tasks, roster, users and access levels, teams, settings), newest first, with search, area filter and pagination. Written after each successful change; a logging failure never blocks the change itself. |
| **Settings** | `/settings` | **Operational Settings** (no code changes needed): *General* (time zone, task code prefix, week start, max labels/links, **roster rules**: max days in a row, min rest between shifts, max hours per week; 0 = off), *Work shifts*, *Leave types*, *Locations*, *Roles*, *Task statuses*, *Story points*, **Coverage targets** (minimum people per shift, per location and day type). Items in use can't be deleted; deactivate them instead. |

## Data store setup

1. Provision the data store and a service identity with read/write access to it; download its credentials JSON into `keys/` (git-ignored).
2. Copy `.env.example` to `.env` and set `DATA_STORE_ID` and `DATA_STORE_KEY_PATH` (path to the credentials JSON). On hosts without a file system (e.g. Netlify) set `DATA_STORE_CLIENT_EMAIL` + `DATA_STORE_PRIVATE_KEY` instead and leave `DATA_STORE_KEY_PATH` unset.
3. Seed sample data (creates/overwrites the `users` table): `npm run seed:data`
4. Create the settings tables: `npm run migrate:settings` (see below).

### Tables

| Table | Purpose | Created |
|---|---|---|
| `users` | People (id, email, name, employeeId, locationId, roleId, access, …) | `seed:data` |
| `roster` | One row per user per day (`id = userId_YYYY-MM-DD`) | automatically on first roster edit |
| `work_tasks` | Tasks and subtasks (`parentId` set = subtask) | automatically on first task |
| `teams` | Teams (id, name, description, leadId, color) | automatically on first team |
| `team_members` | One row per team member (`id = teamId_userId`) | automatically on first team |
| `notifications` | One row per recipient (`userId`, `kind`, `title`, `body`, `href`, `readAt`) | automatically on first notification |
| `leave_requests` | Leave requests (`userId`, dates, `code`, `status`, decision) | automatically on first request |
| `audit_log` | Append-only change history (who, when, area, action, summary) | automatically on first change |
| `coverage_targets` | Minimum people per shift (`id`, `locationId` empty = all, `code`, `days`, `minStaff`, `active`) | automatically on first target |
| `roster_codes` | Work shifts + leave types | `migrate:settings` or first Settings save |
| `locations`, `roles` | Managed lists used by users | `migrate:settings` or first Settings save |
| `task_statuses`, `story_points`, `app_settings` | Task workflow + general settings | `migrate:settings` or first Settings save |

Row 1 of every table is the header (columns are defined in `lib/schema.ts`). **Don't rename header cells by hand**: the app reports a clear error if a required column is missing. Reads are cached for ~15 seconds.

### Migrating older data (`npm run migrate:settings`)

Safe to re-run. It seeds the settings tables from `json/` if they're missing, backs up the `users` table as `users_backup_YYYYMMDD`, replaces the old `stationCode` column with `locationId` (creating a location for each distinct station code), creates a role for each role id in use (rename them in **Settings → Roles**), and adds the `access` column with **every existing person set to Admin** so nobody loses access; then lower people's levels on **Users**. Until it has run, the app shows a banner telling you to run it.

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
| `ANTHROPIC_API_KEY` | Optional, server-only: turns on AI ranking for **Smart assign**. Without it Smart assign uses the deterministic rules |
| `SMART_ASSIGN_MODEL` | Optional model override (default `claude-opus-5-5`) |
| ~~`ADMIN_PASSWORD`~~ | No longer used: remove it |

**Without `AUTH_SECRET` + `GOOGLE_CLIENT_ID/SECRET` a production build answers `503` by design (fail closed).** Locally (`npm run dev`) sign-in is off until you set them. Each deploy-preview origin needs its own redirect URI in Google, or test on the main site URL. Also in place: OAuth `state` + `nonce` + PKCE with full ID-token verification, security headers and CSP, `HttpOnly` + `SameSite=Lax` (+ `Secure` in prod) cookie, throttled sign-in start/callback, `requireSession()` inside every server action, `noindex`. If a person's row already has a different `googleId`, they are treated as not registered (clear the cell to re-bind). After deploying run `npm run smoke -- https://<your-url>` (all lines ✅). Tests: `npm test`, `node scripts/e2e/sso.e2e.mjs` (fake Google + data store) `node scripts/e2e/leave.e2e.mjs` (leave, notifications, audit log, roster panel) and `node scripts/e2e/revoke.e2e.mjs` (revoking approved leave), both in a real browser (need a build and Playwright; shared setup in `scripts/e2e/harness.mjs`). Security audit: `docs/audits/2026-10-24-audit.md`.

### AI-driven development workflow

`.claude/skills/` contains the pipeline **brainstorm -> plan -> feature analysis -> implement -> verify (performance, SEO, quality, constraints) -> validate (unit tests + `feature.md` checklist) -> git -> release**: `dev-workflow`, `feature-checklist`, `code-review-checklist`, `owasp-audit`, `release`. The shared review checklist used in every MusDev99 repo is `.agents/skills/code-review/SKILL.md`; `code-review-checklist` adds this repo's rules and the report file. Per-feature files live in `docs/features/<slug>/feature.md`, reviews in `docs/reviews/`, audits in `docs/audits/`.

## Project structure

- `app/` routes (feature code lives next to its route): `page.tsx` (dashboard), `roster/`, `tasks/`, `users/`, `teams/`, `settings/`, `audit/`, `leave/`, `notifications/`, `whereabouts/`, `manifest.ts` (PWA manifest)
- `public/sw.js` service worker (caches build assets + icons only), `public/offline.html`, `public/icons/` app icons
- `app/components/` shared UI (sidebar + mobile top bar/bottom tabs, `ServiceWorker.tsx` registration, `ui/` primitives: drawer helpers, menus, dialogs, toasts, pagination)
- `lib/` server logic: `store.ts` (data-store client), `actions.ts` (reads), `*-actions.ts` (server actions), `*-validation.ts`, `schema.ts`, `settings.ts` / `shifts.ts` / `task-config.ts` (settings readers), `claude.ts` (server-only Claude API client), `assignee-data.ts` (availability read shared by the picker and Smart assign), `coverage.ts` + `roster-rules.ts` (pure coverage/rest/hours checks, tested), `leave.ts` (pure leave rules, tested) + `leave-actions.ts`, `notifications.ts` (pure, tested) + `notify.ts` (best-effort recorder) + `notification-actions.ts` (own-only read/mark), `audit.ts` (pure audit-log rules, tested) + `audit-log.ts` (best-effort recorder), pure helpers (`smart-assign.ts`, `teams.ts`, `team-validation.ts`, `capacity.ts`, `whereabouts.ts`, `links.ts`, `roster-dates.ts`)
- `json/` seed defaults only (settings live in the data store once migrated)
- `scripts/` one-off seed and migration scripts
- `.claude/skills/appsec-review/` security-review skill (`SKILL.md` checklist + `scan.sh` automated scan); `docs/` review reports
- `proxy.ts` auth gate · `lib/auth-core.ts` / `lib/oidc.ts` / `lib/registration.ts` (pure, tested) · `lib/auth.ts` / `lib/auth-actions.ts` · `app/api/auth/google/` (start + callback) · `app/login/`
- `tests/` unit tests · `docs/` features, reviews, audits · `.claude/skills/` AI dev workflow
- `CLAUDE.md` project rules for contributors/AI (architecture, UX standard, definition of done)

## Security

### Access levels
Every person has one access level (separate from their job **Role**). The server checks it on every change, so hidden buttons are only a convenience.

| Can… | Admin | Planner | Lead | Member |
|---|---|---|---|---|
| View Whereabouts, Roster, Tasks, Teams | ✅ | ✅ | ✅ | ✅ |
| Edit roster cells | ✅ | ✅ | people in teams they lead | — |
| Clear schedule / import roster CSV | ✅ | ✅ | — | — |
| Create, edit, delete tasks | ✅ | ✅ | ✅ | status of own tasks only |
| Teams | ✅ | ✅ | edit details of teams they lead | — |
| Users and access levels | ✅ | — | — | — |
| Settings | ✅ | view only | — | — |
| Request leave (for yourself) | ✅ | ✅ | ✅ | ✅ |
| Approve / reject leave | ✅ | ✅ | people in teams they lead (not themselves) | — |
| Revoke approved leave | ✅ | ✅ | their teams, and their own | their own |
| Audit log | ✅ | — | — | — |

Screens follow the level: links you can't use are hidden from the menu, Users and Settings show a *no access* page to people without access, Settings is view-only for Planners, Users is view-only for Planners and Leads, Leads edit only the details of teams they lead and open the Roster on **My teams** (rows of people outside their teams are locked and labelled), and Members see the roster and tasks view-only (they can still move tasks assigned to them). New people start as **Member**. There must always be one active Admin. A change of level applies to the person's next action. Run `npm run migrate:settings` once after upgrading (until then everyone keeps full access).

Run the project's security-review skill before releases and after adding a server action, form, URL field, import or dependency: ask Claude Code to *"run the appsec-review skill"*, or run the automated part directly with `bash .claude/skills/appsec-review/scan.sh`. Reports are kept in `docs/` (latest: `docs/security-review-2026-10-24.md`).

## Progressive Web App

| Piece | Where | Notes |
|---|---|---|
| Manifest | `app/manifest.ts` → `/manifest.webmanifest` | name, icons (192/512 + maskable + SVG), standalone, theme colour, Roster/Tasks shortcuts |
| Service worker | `public/sw.js` (registered in production only, when the page is idle) | cache-first for `/_next/static/*` and `/icons/*`; **pages and server actions are never cached** (private staff data) — offline navigations show `public/offline.html` |
| Public files | `proxy.ts` matcher | manifest, `sw.js`, `offline.html` and `icons/` are served without a session |
| Headers | `next.config.ts` | `sw.js` is `no-cache` (updates roll out on next visit); CSP adds `worker-src 'self'` and `manifest-src 'self'` |

To ship a service-worker change that must evict old caches, bump `VERSION` in `public/sw.js`.

## 🌿 Branches

Follows [BRANCHING.md](https://github.com/MusDev99/agentic-coding-style/blob/main/BRANCHING.md): `feat/`, `fix/`, `chore/` or `docs/` branches, Conventional Commit PR titles, squash merge.

| Workflow | What it does |
|---|---|
| `.github/workflows/branch-policy.yml` | Fails a PR whose branch name or title breaks the rules |
| `.github/workflows/branch-cleanup.yml` | Deletes the PR's branch once it is merged (skips forks, the default branch and branches another open PR is based on) |

Keep **Settings → General → Automatically delete head branches** on as well; the workflow is the backup.

## Changelog

- **Unreleased · Page headers & stat cards restyle**: every page title now has the sign-in page's pink-to-amber accent bar and a heavier weight, with a very soft glow behind the content area; stat cards (`StatCard`, Roster summary) get a tone-tinted corner glow, a tone top line and border, bolder values and readable labels; the Tasks header icon uses the Tasks amber instead of the destructive red; the phone stat strip now has a proper gutter. CSS plus a one-line `StatCard` change; no behaviour change.
- **Unreleased · App shell restyle**: the sidebar, phone top bar and bottom tabs now match the new sign-in page: two-tone **Work|Force** wordmark, soft pink/emerald glow, each menu icon in a tinted tile (a tone per section, `tone-*` classes), an outlined active link with an accent bar, a rounded account card, tile-style menu and bell buttons, and a tinted pill on the active phone tab. No behaviour change (same links, access rules, unread badge, drawer). Targets stay ≥ 44px; muted menu text now uses the readable secondary colour.
- **Unreleased · New sign-in page**: landing-style `/login` — gradient headline, four feature cards, a wide **Continue with Google** button and (desktop) a decorative roster preview with floating status chips. On phones the button comes first and the preview is hidden. Sign-in behaviour is unchanged (same refusal banner, WhatsApp contact and error messages). The first keyboard stop is the button; one `h1`; fine print uses the readable secondary text colour. Components: `app/login/page.tsx`, `LoginPreview.tsx`.
- **Unreleased · Revoke approved leave**: the requester can cancel, and approvers can revoke, approved leave that has not ended. Only roster days from today on that still hold the leave code are cleared (changed days are left alone, past days stay); leave not started becomes *Revoked*, leave under way is shortened to end yesterday. The other side is notified (new `leave_revoked` notification kind) and it is audit-logged. Browser e2e: `scripts/e2e/revoke.e2e.mjs` (19 checks); the e2e scripts now share `scripts/e2e/harness.mjs`. Spec: `docs/features/leave-revoke/feature.md`.
- **Unreleased · Notifications**: in-app inbox (`/notifications`, new `notifications` table) with an unread badge; leave requests notify approvers, decisions notify the requester, task assignment notifies the assignee. Best effort (never blocks the change), own-only, internal links only. No email or push yet (needs a mail/push provider and secrets). Covered by `scripts/e2e/leave.e2e.mjs` (33 checks). Spec: `docs/features/notifications/feature.md`.
- **Unreleased · Leave requests**: new **Leave** page. Members request time off, planners/admins (and leads for their teams) approve or reject; approval writes the leave code into the roster. New `leave_requests` table, `leave.request` / `leave.decide` capabilities, audit entries, and a browser e2e (`scripts/e2e/leave.e2e.mjs`, backed by an in-memory multi-table fake store). Also: the Audit log table now collapses to cards on phones (shared `.card-table`), its error banner is styled, and the Roster panel no longer says "All clear" when the roster failed to load. Spec: `docs/features/leave-requests/feature.md`.
- **Unreleased · Coverage targets & roster rules**: set a minimum head-count per shift (optionally per location and Mon–Fri / Sat–Sun) under *Settings → Coverage targets*, and rest / days-in-a-row / weekly-hours limits under *Settings → General*. The Roster shows a **Coverage & rules** panel (live with edits; neighbouring months count for runs and weeks that cross the month edge). Warnings only; nothing is blocked. Deleting a shift or location removes its targets. Spec: `docs/features/coverage-rules/feature.md`.
- **Unreleased · Audit log, tasks export, lint**: admins get a read-only **Audit log** (`/audit`, new `audit_log` table) recording changes to tasks, roster, users/access, teams and settings; **Export CSV** on Tasks (current filters, with subtasks; formula-safe); `npm run lint` works again (ESLint flat config for Next 16) and is part of `npm run verify`. Remaining React-rule findings are warnings. Spec: `docs/features/audit-log/feature.md`.
- **Unreleased · My schedule**: new `/me` page (first tab) with today's shift, the next 14 days and your open tasks with a quick status change; members land on it after signing in. Teams moved from the phone tab bar to the menu.
- **Unreleased · Access levels, part 3**: on the Roster, Leads start on a **My teams** filter; rows of people outside their teams show a lock and *Not in your teams* and don't edit; *assign all* skips them and says how many.
- **Unreleased · Access levels, part 2**: screens match each level: menu items hidden, *no access* page for Users/Settings, view-only Settings (Planners), Users (Planners, Leads), Roster and task drawer (Members); Leads edit only details of teams they lead; Clear/Upload roster only for Planners and Admins.
- **Unreleased · Branch cleanup**: `branch-policy.yml` checks branch names and Conventional Commit PR titles; `branch-cleanup.yml` deletes a PR's branch after it is merged.

- **Unreleased · Shared code-review skill**: `.agents/skills/code-review/SKILL.md`, the same 7-area review checklist (intent, readability, tests, security, performance, style, docs) used in every repo, findings by severity.

- **Unreleased · Smart assign (AI pilot)**: *Smart assign* panel in the task drawer suggests up to 3 assignees with reasons. Rules score availability (50) + workload (30) + past-task experience (20); with `ANTHROPIC_API_KEY` set, Claude re-ranks and explains the top 8 (pseudonymised: no names, emails or ids leave the server). Falls back to the rules on no key, timeout, refusal or rate limit. Never auto-assigns. Spec: `docs/features/smart-assign/feature.md`.

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
