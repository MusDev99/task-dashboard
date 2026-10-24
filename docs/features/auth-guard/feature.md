# Feature: Auth guard + OWASP hardening

**Status:** ✅ verified · **Branch:** `ccr-842b3a88-ddan6t` (convention: `feat/auth-guard`) · **Target version:** 0.2.0

## 1. 🧠 Brainstorm
**Problem** — the app holds staff names, emails and phone numbers and every server action (delete user, rewrite roster) was callable by anyone with the URL (README warned about it).

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. Host-level password (Netlify/Vercel) | zero code | host/plan specific, no per-action guard, not portable | S | |
| B. Shared password + signed cookie (Web Crypto) | no deps, runs on Vercel + Netlify, testable | single shared secret, no per-user audit trail | M | ✅ |
| C. OAuth/OIDC (Google SSO via Auth.js) | per-user identity, SSO | more config, new deps, needs user<->email mapping | L | later |

**Decision** — B now, with the guard isolated in `lib/auth*.ts` so C can replace it without touching call sites.

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Status |
|---|---|---|---|
| 1 | Session core + proxy + `/login` + sign-out | M | ✅ |
| 1 | `requireSession()` in every server action | S | ✅ |
| 1 | Security headers + `noindex` | S | ✅ |
| 2 | Per-user SSO (Google) mapped to the `users` tab, roles for admin vs viewer | L | ⬜ |
| 2 | Audit log tab (who changed what) | M | ⬜ |

## 3. 🔬 Feature analysis
### 3.1 Acceptance criteria
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Given no session, when any page is requested, then 307 to `/login?next=...` | smoke + browser |
| AC-2 | Given no session, when a server action is POSTed, then 401 and no data-store access | smoke |
| AC-3 | Given a wrong password, when submitting, then a generic error; 6th attempt in 10 min is throttled | `auth-core.test.ts` (limiter) + browser |
| AC-4 | Given the right password, then an `HttpOnly; SameSite=Lax` (`Secure` in prod) cookie is set and the user lands on `next` | browser |
| AC-5 | Given `next=https://evil.test` or `//evil`, then redirect falls back to `/` | `auth-core.test.ts` |
| AC-6 | Given production without `ADMIN_PASSWORD`/`AUTH_SECRET`, then 503 (fail closed) unless `AUTH_DISABLED=true` | curl |
| AC-7 | Given a tampered or expired cookie, then it is rejected | `auth-core.test.ts` |
| AC-8 | `/login` works at 375px with no horizontal scroll, 44px targets | browser |

### 3.2 Data impact
None (no data changes). New env vars: `ADMIN_PASSWORD`, `AUTH_SECRET`, optional `AUTH_DISABLED`.

### 3.3 Threat model — OWASP Top 10 (2021)
| Risk | Relevant? | Mitigation / evidence |
|---|---|---|
| A01 | ✅ | `proxy.ts` gates all routes; `requireSession()` re-checks in all 18 server-action exports; only same-site `next` paths |
| A02 | ✅ | HMAC-SHA256 signed expiring token; secrets only in env; `Secure` cookie in prod; HSTS |
| A03 | ✅ | server validation unchanged (`lib/validation.ts`); Data writes stay `RAW`; React escapes output |
| A04 | ✅ | fail closed in production when unconfigured; explicit `AUTH_DISABLED` opt-out |
| A05 | ✅ | CSP, `X-Frame-Options`, nosniff, Referrer-Policy, Permissions-Policy, COOP, `poweredByHeader: false` |
| A06 | ✅ | `npm audit fix`: 6 -> 0 vulnerabilities (Next 16.1.6 -> 16.4.3) |
| A07 | ✅ | constant-time compare (HMAC both sides), throttle 5/10 min/IP, single generic error, 8h session |
| A08 | ✅ | lockfile committed; Next built-in Origin check for server actions |
| A09 | ✅ | failures logged server-side, never returned to the client |
| A10 | n/a | no user-controlled outbound requests |

### 3.4 Laws of UX
| Law | Applied how |
|---|---|
| Hick | login = one field, one button |
| Fitts | full-width 44px submit and sign-out |
| Jakob | familiar password form, `autocomplete=current-password` |
| Doherty | pending state on submit ("Signing in…") |
| Postel | password accepted as typed (no trimming surprises), strict cookie |
| Peak-End | redirect straight back to the page that was requested |

### 3.5 Mobile-first (375px)
Centered card, `100dvh` wrapper, no horizontal overflow (verified with Playwright at 375px).

### 3.6 Out of scope
Per-user identity/roles, password reset, MFA, distributed rate limiting (in-memory per instance).

## 4. 🔨 Implementation checklist
- [x] Smallest diff; Web Crypto only, no new dependency
- [x] Server-side validation + generic error messages
- [x] Auth guard on every route and server action
- [x] Error state on `/login`; unconfigured state explained
- [x] No `any`, `@ts-ignore`, secrets
- [x] Env vars in `.env.example`

## 5. 📏 Verification gates
- [x] **Performance** — proxy does one HMAC per request (sub-millisecond); no extra data-store calls; `MigrationNotice` skips the data store read when signed out
- [x] **SEO** — private app: `robots: noindex` in `app/layout.tsx`
- [x] **Quality** — `npm run verify` green (tsc, 6 tests, build); Lighthouse not run (needs network install)
- [x] **Constraints** — CLAUDE.md updated (auth rule replaces "no authentication yet")

## 6. ✅ Validation
| AC | Evidence | Result |
|---|---|---|
| AC-1 | `scripts/smoke.mjs`: all pages 307 -> `/login` | ✅ |
| AC-2 | POST with `next-action` header -> 401 | ✅ |
| AC-3 | Playwright: wrong password shows "Incorrect password."; limiter unit test | ✅ |
| AC-4 | Playwright: cookie `wf_session` HttpOnly, SameSite=Lax; lands on `/users` | ✅ |
| AC-5 | `safeNext` unit test | ✅ |
| AC-6 | `next start` without env -> 503; with `AUTH_DISABLED=true` -> 200 | ✅ |
| AC-7 | token tamper/expiry unit tests | ✅ |
| AC-8 | Playwright 375px: no horizontal overflow | ✅ |

- [x] Unit tests added and passing
- [x] Browser pass at 375px and desktop
- [ ] Sign-out and idle-expiry exercised in a browser (not run yet)
- [ ] Netlify deploy preview + `npm run smoke -- <url>` (needs the owner's env vars)

## 7. 🌿 Git & 🚀 release
- [x] Conventional commits · README + CLAUDE.md updated
- [ ] Release 0.2.0: **set `ADMIN_PASSWORD` and `AUTH_SECRET` in Netlify before deploying** (otherwise the site returns 503 by design)
- Rollback: Netlify -> Deploys -> publish the previous deploy.
