# Feature: <name>

**Status:** 🧠 brainstorm · 📐 planned · 🔨 building · ✅ verified · 🚀 released  (delete all but one)
**Owner:** <you> · **Branch:** `feat/<slug>` · **Issue/PR:** <link> · **Target version:** <x.y.z>

## 1. 🧠 Brainstorm
**Problem** — who is affected, how often, what it costs today:

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A | | | S/M/L | |
| B | | | S/M/L | |

**Decision & rationale:**

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk | Status |
|---|---|---|---|---|
| 1 | smallest shippable slice | | | ⬜ |
| 2 | | | | ⬜ |

## 3. 🔬 Feature analysis
### 3.1 Acceptance criteria
| ID | Given / When / Then | Test (unit / manual) |
|---|---|---|
| AC-1 | | |

### 3.2 Data impact
Tabs / columns / migrations / caches touched · backward compatibility · rollback of data:

### 3.3 Threat model — OWASP Top 10 (2021)
| Risk | Relevant? | Mitigation / evidence |
|---|---|---|
| A01 Broken access control | | auth on every endpoint/action, ownership checks |
| A02 Cryptographic failures | | secrets in env only, signed tokens, HTTPS |
| A03 Injection | | server validation, formula injection, URL schemes, XSS encoding |
| A04 Insecure design | | abuse cases, rate limits, fail-closed defaults |
| A05 Security misconfiguration | | headers/CSP, generic errors, no debug output |
| A06 Vulnerable components | | `npm audit --omit=dev` clean or waived |
| A07 Auth failures | | throttling, constant-time compare, session expiry |
| A08 Integrity failures | | lockfile, trusted CDNs only, CSRF/origin check |
| A09 Logging & monitoring | | errors logged server-side, no secrets in logs |
| A10 SSRF | | outbound fetch only to fixed hosts, user input URL-encoded |

### 3.4 Laws of UX
| Law | Applied how |
|---|---|
| Hick | |
| Fitts (>= 44px) | |
| Jakob | |
| Miller | |
| Doherty (< 400ms) | |
| Postel / Tesler / Peak-End | |

### 3.5 Mobile-first (375px)
Layout, thumb-zone actions, no horizontal scroll, keyboard + screen reader notes:

### 3.6 Out of scope

## 4. 🔨 Implementation checklist
- [ ] Smallest diff; reused existing components/helpers
- [ ] Server-side validation + generic error messages
- [ ] Auth guard on every new route / action / endpoint
- [ ] Empty, loading, error states
- [ ] No hardcoded data, `any`, `@ts-ignore`, secrets, stray logs
- [ ] Env vars documented in `.env.example`

## 5. 📏 Verification gates
- [ ] **Performance** — build output compared, data-store call count noted, heavy libs lazy
- [ ] **SEO** — titles/meta/canonical (public) or `noindex` (private); heading structure; alt text
- [ ] **Quality** — `npm run verify` green; Lighthouse (mobile) perf >= 90, a11y >= 95, best-practices >= 95
- [ ] **Constraints** — CLAUDE.md rules re-read; OWASP table above complete; Laws of UX noted in PR

## 6. ✅ Validation
| AC | Evidence (test name / steps / screenshot) | Result |
|---|---|---|
| AC-1 | | ⬜ |

- [ ] Unit tests added/updated and passing
- [ ] Browser pass at 375px and desktop (empty, error, keyboard-only)
- [ ] Stored data verified after create / edit / delete; test rows removed

## 7. 🌿 Git & 🚀 release
- [ ] Branch name follows convention; Conventional Commit messages
- [ ] CHANGELOG entry + README/CLAUDE.md updated in the same change
- [ ] PR opened with summary, risk, test evidence, screenshots (mobile + desktop)
- [ ] Version bump + tag per `release` skill; deploy preview smoke test green
- [ ] Rollback plan noted

## 8. Sign-off
Reviewer: <name> · Date: <YYYY-MM-DD> · Verdict: ✅ approve / 🔁 changes
