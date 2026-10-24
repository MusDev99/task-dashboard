# Security review — 2026-10-22

**Scope:** whole repository at `master` (+ uncommitted work), 18 server actions, 7 pages, `lib/store.ts`, build/deploy config, dependencies.
**Method:** automated scan (`.claude/skills/appsec-review/scan.sh`) + manual review of every server action and input path; runtime checks against a production build (`next build && next start`).
**Context:** deployed on Netlify, internet-facing, **no authentication**.

## Summary

| ID | Severity | Title | Status |
|---|---|---|---|
| H1 | **High** | No authentication or authorization: anyone can read all staff data and modify/delete everything | Open |
| H2 | **High** | Vulnerable dependencies (1 critical, 4 high, 1 moderate) incl. `next` 16.1.6 | Open (fix available) |
| H3 | **High** (if repo is public) / Medium | Real staff personal data committed in `json/users.json` | Open |
| M1 | Medium | No rate limiting; anonymous traffic can exhaust the data store's request quota and take the app down | Open |
| M2 | Medium | Missing security headers (CSP, clickjacking protection, nosniff, referrer/permissions policy) | Open |
| M3 | Medium | User-supplied avatar URLs are loaded by every viewer's browser (IP/tracking disclosure) | Open |
| M4 | Medium | Git history still reveals the data-store vendor and a real service-account identifier | Open |
| L1 | Low | Client-controlled `kind` argument isn't allow-listed (prototype keys accepted by the lookup) | Open |
| L2 | Low | `X-Powered-By: Next.js` header disclosed | Open |
| L3 | Low | Placeholder `/docs/[...slug]` route is unnecessary attack surface | Open |
| L4 | Low | `npm run seed:data` silently overwrites live tables | Open |
| I1 | Info | `next dev` embeds the data-store request URL in page payloads (dev only) | Noted |

## Findings

### H1 — No authentication or authorization
- **Where:** all of `lib/*-actions.ts` (18 exported server actions); every page.
- **Evidence:** scan finds no `middleware.ts`/`proxy.ts` and no session/role checks anywhere. Anonymous requests to `/`, `/users`, `/roster`, `/tasks`, `/settings` all return `200` on the production build. Every exported server action is a public endpoint whose id ships in the client bundle; `deleteUser`, `clearSchedule`, `saveSetting`, `deleteSetting`, `saveGeneral`, `importRoster` need no credentials.
- **Impact:** any visitor can read every employee's name, email, phone and Google account id (`/users`, profile pages, exports), and can create/alter/delete users, roster entries, tasks and organisation settings. `deleteUser` cascades to roster and tasks.
- **Fix (smallest first):** (1) immediately enable host-level protection (Netlify password/SSO protection) so the site isn't open; (2) add real sign-in (e.g. company SSO) with a session, a `proxy.ts` that redirects unauthenticated page requests, and a `requireRole("admin"|"member")` guard called at the top of **every** server action (pages alone are not enough: actions can be called directly); (3) restrict read actions (`getUsageCounts`, `getAssigneeAvailability`, `fetchRosterMonth`) the same way; (4) log who changed what.

### H2 — Vulnerable dependencies
- **Where:** `package.json` / lockfile. `npm audit --omit=dev`: 6 vulnerabilities — `next` (critical), `postcss`, `sharp`, `nanoid`, `source-map-js` (high), `baseline-browser-mapping` (moderate). All have fixes available.
- **Relevance here:** `next` 16.1.6 advisories are *request smuggling in rewrites* (no rewrites configured → not exploitable) and *unbounded `next/image` disk-cache growth* (`next/image` **is** used for avatars on the dashboard, leaderboard and profile pages → exploitable as storage/availability DoS). `sharp` is the image optimiser behind that feature.
- **Fix:** `npm audit fix`, run `npx tsc --noEmit` and `npm run build`, smoke-test the pages, redeploy. Re-run the scan after.

### H3 — Staff personal data committed to the repository
- **Where:** `json/users.json` (tracked): 34 records with email (34), phone (2), Google account id (30) and avatar URL (30); present in history (`0ed2619`, `52f3ed3`).
- **Impact:** if the repository is or ever becomes public, this is a personal-data leak. Even private, it is broader access than needed. (Repository visibility could not be checked from here: confirm it is **private**.)
- **Fix:** replace `json/users.json` with synthetic sample data, keep real data only in the data store, and purge the history if the repository was ever public (rewrite + force push, rotate nothing secret but notify per your data-protection policy).

### M1 — No rate limiting / quota exhaustion
- **Where:** all actions and page loads; `lib/store.ts` (`readTable` cache is per server instance, 15 s).
- **Evidence:** an uncached page render reads about 6 tables; one `setCells` is 2–4 API calls; `importRoster` accepts up to 5,000 rows. The backing service has a per-minute request quota; serverless cold instances don't share the cache.
- **Impact:** an anonymous script (or just a crawler) can exhaust the quota, after which **every** page shows the error banner: an easy outage.
- **Fix:** authentication (H1) removes most of the risk; add per-IP/session rate limiting (e.g. edge rate-limit rules on the host), share the read cache across instances (e.g. short-TTL edge/KV cache), and lower `MAX_CELLS`/import caps to what the UI really needs.

### M2 — Missing security headers
- **Evidence (production build):** missing `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (HSTS is normally added by the host; verify on the deployed URL).
- **Impact:** the admin UI can be framed (clickjacking: dangerous while there's no authentication), no defence in depth for XSS.
- **Fix:** add `headers()` in `next.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a CSP with `frame-ancestors 'none'`, `img-src 'self' https: data:` and `style-src 'self' 'unsafe-inline'` (the app uses inline styles) plus Next's script nonce. Test CSP in a browser before shipping.

### M3 — Arbitrary image URLs loaded by viewers' browsers
- **Where:** `app/components/ui/Avatar.tsx:23` (`<img src={avatar}>`); validation only requires `https://` (`lib/validation.ts`).
- **Impact:** a user (or anyone, given H1) can set an avatar URL on an attacker-controlled host; every person who opens the users list or leaderboard sends a request to that host, revealing their IP and when they looked. No script execution (it is an `<img>`).
- **Fix:** restrict to an allow-list of image hosts (and keep `next/image` with `remotePatterns`), or accept uploads and serve them from your own storage.

### M4 — Repository history reveals the vendor and a service identifier
- **Where:** commit `b996709` and earlier: old file `lib/googleSheets.ts`, an `.env.example` that contained a real service-account email and project id.
- **Impact:** contradicts the confidentiality requirement; the identifier is not a secret key but reveals the project and vendor. **No private key was ever committed** (checked: no key bodies in tracked files or history; only placeholder text matched).
- **Fix:** if history must be clean, rewrite it (`git filter-repo`) and force-push; consider rotating the service identity. Current working tree/docs/UI contain no vendor names (verified in served pages and browser bundles).

### L1 — `kind` argument not allow-listed
- **Where:** `lib/settings-actions.ts:45,88,123,131`, `lib/settings-validation.ts:30` (`SPECS[kind]` on a client-supplied value).
- **Evidence:** a plain-object lookup returns inherited members for `"__proto__"`, `"constructor"`, `"toString"` (verified in Node), so an `if (!SPECS[kind])` style check would not reject them.
- **Impact today:** none exploitable: the remaining code sits inside `try/catch` and ends in a generic error, nothing is written. Defence in depth only.
- **Fix:** `if (!Object.hasOwn(SPECS, kind)) return { ok: false, message: "Unknown setting type." }` at the top of `saveSetting`, `setSettingActive`, `deleteSetting`.

### L2 — `X-Powered-By` header
- **Fix:** `poweredByHeader: false` in `next.config.ts`.

### L3 — Placeholder docs route
- **Where:** `app/docs/[...slug]/page.tsx` renders its URL segments (escaped by React, so no XSS) but has no purpose. **Fix:** delete it.

### L4 — Destructive seed script
- **Where:** `scripts/seed-data.ts` (`npm run seed:data`) overwrites the `users` and `tasks` tables. A mistaken run on production data destroys it. **Fix:** require `--force`/an interactive confirmation and refuse when the target tables are non-empty.

### I1 — Development-mode payload
- `next dev` embeds each server-side request URL (including the store id) in page payloads. Production output is clean (0 occurrences in 5 pages and all browser bundles). Never expose a dev server publicly.

## Checked and OK
- **Server-side validation** on every write path (`user`, `task`, `roster`, `settings`): types, lengths, enums, existence of referenced ids, uniqueness, date sanity; updates can't overwrite `id`/`code`/`parentId`/keys.
- **No injection into the data store:** writes use `RAW` (formulas never evaluated; no `USER_ENTERED` anywhere); table names come from constants; row targeting uses numeric indexes; ids are `crypto.randomUUID()`.
- **XSS:** no `dangerouslySetInnerHTML`/`innerHTML`/`eval`; all user text rendered as React text; links restricted to `http(s)` at validation (`safeUrl`) and rendered with `target="_blank" rel="noopener noreferrer"`.
- **CSV:** export neutralises formula-leading characters; import is capped (5,000 rows) and fully validated before any write.
- **No SSRF:** the server never fetches user-supplied URLs; the only `fetch` is in `lib/store.ts` to a fixed host.
- **Secrets:** no credential files or key bodies tracked or in history; `keys/`, `.env*`, credential files are git-ignored; `.env.example` is placeholders only; key-parsing errors report lengths/markers, never values; nothing server-only is imported into client components.
- **Error handling:** actions return generic messages and log details; pages degrade to banners instead of stack traces.
- **Confidentiality:** 0 vendor strings in served pages and browser bundles; docs/UI/messages scrubbed.
- **Integrity:** dependents deleted before parents; in-use protection for settings; immutable codes/keys; confirmations on destructive UI actions.

## Needs confirmation
- Repository visibility (public/private) and who has access: drives H3.
- Whether the Netlify site already has password/SSO protection (drives urgency of H1).
- HSTS on the deployed domain (expected from the host).

## Recommended order of fixes
1. **H1** — protect the site today (host-level), then implement sign-in + per-action authorization.
2. **H2** — `npm audit fix`, rebuild, retest, redeploy.
3. **H3 / M4** — remove real staff data from the repo; decide on history rewrite.
4. **M2, L1, L2, L3** — one small hardening change (headers, `hasOwn`, `poweredByHeader`, delete placeholder route).
5. **M1, M3, L4** — rate limiting/shared cache, avatar allow-list, seed-script guard.
