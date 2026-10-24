# Feature: Google SSO login with registration check

**Status:** ✅ verified (fake Google/Sheets) · ⬜ real Google on a Netlify preview pending · **Branch:** `ccr-842b3a88-ddan6t` (convention: `feat/sso-login`) · **Target version:** 0.3.0

## 1. 🧠 Brainstorm
**Problem** — one shared password has no per-person identity, can't be revoked for one person, and leaks by being shared. The owner wants SSO, and people who are not registered should be told to contact the owner.

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. Auth.js (NextAuth) Google provider | batteries included | new dependency, Next 16 compatibility risk, adapter for Sheets | M | |
| B. Hand-rolled OIDC code flow + PKCE | no dependency, fits `auth-core`, fully unit-testable | we own the security details | M | ✅ |
| C. Netlify Identity / host SSO | no code | host-specific, no link to the `users` tab | S | |

**Decision** — B. "Registered" = an **active** row in `users` (Google `sub` in `googleId`, else email).

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Status |
|---|---|---|---|
| 1 | OIDC start + callback, ID-token verification, registration match | M | ✅ |
| 1 | Identity in the session, sidebar user, sign-out | S | ✅ |
| 1 | Not-registered / deactivated / unavailable banners + WhatsApp link | S | ✅ |
| 1 | Unit tests + fake-Google e2e | M | ✅ |
| 2 | Real Google credentials on a Netlify preview, smoke test | S | ⬜ owner |
| 2 | Per-user roles (admin / viewer), re-check `isActive` on each request | M | ⬜ |

## 3. 🔬 Feature analysis
### 3.1 Acceptance criteria
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Signed out, any page -> `/login?next=...`; Google button starts the flow | e2e |
| AC-2 | Registered + active user signs in and lands on `next` | e2e (desktop + 375px) |
| AC-3 | First sign-in binds `googleId` to the row | e2e + `matchUser` test |
| AC-4 | Unknown email -> **no session**, banner "<email> isn't registered" + **Contact me on WhatsApp** (`wa.me`, prefilled with the email) | e2e |
| AC-5 | Deactivated user -> banner, no session | e2e |
| AC-6 | A row bound to a different Google account is not taken over by email | unit |
| AC-7 | Wrong nonce / forged state / bad signature / wrong aud, iss, exp / unverified email / wrong domain is rejected | unit + e2e |
| AC-8 | Sheets outage -> "unavailable", never "not registered" | e2e |
| AC-9 | Flash and OAuth cookies can't be used as a session; tampered or expired sessions rejected | unit |
| AC-10 | Open redirect via `next` blocked | unit |
| AC-11 | 375px: no horizontal scroll, 44px targets | e2e |

### 3.2 Data impact
`users.googleId` is now written by the system on first sign-in (best effort). No new tabs or columns. Rows that already hold a `googleId` (seed data has 30) must match the person's real Google `sub`; otherwise clear the cell.

### 3.3 Threat model — OWASP Top 10 (2021)
| Risk | Relevant? | Mitigation / evidence |
|---|---|---|
| A01 | ✅ | proxy + `requireSession()`; access = active `users` row; same-site `next` only |
| A02 | ✅ | HMAC-signed typed cookies; `Secure`/`HttpOnly`/`SameSite=Lax`; client secret only in env |
| A03 | ✅ | email compared normalised; banner text rendered by React (escaped); WhatsApp text `encodeURIComponent` |
| A04 | ✅ | fail closed (503); outage never reads as "not registered" |
| A05 | ✅ | no new third-party origin in the browser (server-side token exchange); CSP unchanged |
| A06 | ✅ | no new dependency |
| A07 | ✅ | state + nonce + PKCE, one-time oauth cookie (10 min), throttled start/callback, `email_verified` required, optional `hd` domain |
| A08 | ✅ | ID token signature verified against Google JWKS (RS256 only) |
| A09 | ✅ | refusal reasons logged server-side; flash cookie holds the email 5 min for the banner only |
| A10 | ✅ | fixed Google hosts (`googleEndpoints`), no client-supplied URL |

### 3.4 Laws of UX
| Law | Applied how |
|---|---|
| Hick | one primary action on the page: Sign in with Google |
| Fitts | full-width 44px button and WhatsApp contact button |
| Jakob | standard "Sign in with Google" pattern |
| Von Restorff | one filled accent button; the banner uses the warning tone, red stays for errors |
| Tesler | the system binds `googleId` automatically; nobody types ids |
| Peak-End | returns the person to the page they asked for; clear message and next step when refused |

### 3.5 Mobile-first (375px)
Single column card, banner stacks the contact button under the text (screenshot checked).

### 3.6 Out of scope
Roles, SSO for tokyo-itinerary, self-registration, other providers.

## 4. 🔨 Implementation checklist
- [x] Smallest diff, no new dependency
- [x] Server-side validation (state, nonce, token, registration)
- [x] Guard on every route (proxy allow-list is only `/login` and `/api/auth/*`)
- [x] Empty / error / outage states on `/login`
- [x] No `any`, `@ts-ignore`, secrets
- [x] Env vars in `.env.example`

## 5. 📏 Verification gates
- [x] **Performance** — one cached Sheets read per sign-in; sidebar reads the cached `users` tab (15 s cache)
- [x] **SEO** — private app, `noindex` unchanged
- [x] **Quality** — `npm run verify` (tsc + 16 unit tests + build)
- [x] **Constraints** — CLAUDE.md + README updated

## 6. ✅ Validation
| AC | Evidence | Result |
|---|---|---|
| AC-1..AC-5, AC-8, AC-11 | `node scripts/e2e/sso.e2e.mjs` (18 checks, fake Google + Sheets) | ✅ |
| AC-6, AC-7, AC-9, AC-10 | `tests/*.test.ts` | ✅ |

- [x] Unit tests added and passing
- [x] Browser pass at 375px and 1280px against a production build
- [ ] **Real Google sign-in on a Netlify preview** (needs the OAuth client; not possible in this sandbox)
- [ ] Sign-out button exercised in a browser

## 7. 🌿 Git & 🚀 release
- [x] Conventional commits · README + CLAUDE.md updated
- [ ] Release: create the Google OAuth client, set `GOOGLE_CLIENT_ID/SECRET`, `APP_URL`, `AUTH_SECRET`, `CONTACT_WHATSAPP` in Netlify, remove `ADMIN_PASSWORD`, then `npm run smoke -- <url>`. Everyone signs in again once.
- Rollback: Netlify -> publish the previous deploy (the old build still wants `ADMIN_PASSWORD`, so keep it set until SSO is confirmed).
