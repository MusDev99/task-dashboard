---
name: appsec-review
description: Security review of the WorkForce Management codebase (Next.js server actions + data-store backend). Use when the user asks for a security review/audit/code analysis, before a release or deploy, after adding a server action, form, link/URL field, CSV import, settings option or dependency, or when checking for secret/PII/vendor-name leaks. Runs an automated scan, then a manual review against this app's threat model, and reports verified findings with severity, evidence and fixes.
---

# AppSec review — WorkForce Management

Review the code for real, verified vulnerabilities in **this** app. Report; don't change code unless the user asks (then fix one finding per change and re-run the scan).

## 0. Ground rules
- **Never read, print or grep secret files** (`.env*`, `keys/`). Check *whether* secrets are tracked/committed, never their values. Don't echo credentials in findings.
- **Confidentiality rule:** the underlying data store / vendor must never be named in UI text, messages shown to users, docs, comments, commits or your report. Say "the data store". Flag any leak as a finding (see §3.10).
- Only report what you verified: show `file:line`, the exact code, and a concrete exploit or failure path. Say "not exploitable because…" for things you checked and ruled out. Unverified suspicion → list under "Needs confirmation", not findings.
- Distinguish **dev-only** behaviour (`next dev` embeds request info in page payloads) from production: test production with `npx next build && npx next start -p 3003` (stop any dev server first; building under a running dev server corrupts it).

## 1. Run the automated scan first
```bash
bash .claude/skills/appsec-review/scan.sh
```
It prints: every server action (each is a public endpoint), dangerous sinks, tracked/committed secret-like files, dependency audit summary, response headers of a production build, and vendor-name leaks in source and browser bundles. Treat its output as leads; verify each in code.

## 2. Map the attack surface (≈5 min)
1. `lib/*-actions.ts` → every exported `async function` under `"use server"` is callable by anyone who can reach the site (arguments are attacker-controlled; the action id is visible in the client bundle). Read each one top to bottom.
2. Pages (`app/**/page.tsx`) → what data each renders, and to whom (is there any auth? `middleware.ts`/`proxy.ts`, session, role check).
3. Client components that accept input: drawers/forms, CSV upload (`app/roster/UploadCsvDialog.tsx`, `csv.ts`), link/URL/avatar fields, search/filter query params (`?q=`, `?date=`, `?month=`, `?tab=`).
4. `lib/store.ts` (the only module that talks to the data store), `next.config.ts`, `netlify.toml`, `package.json` scripts, `scripts/`.

## 3. Threat checklist (this app's specifics)
For each item decide: Verified issue / Safe (why) / N/A.

1. **Authentication & authorization (highest priority).** Is any server action or page protected? Can an anonymous caller read PII (`users`: emails, phones, ids) or create/update/delete users, roster, tasks, settings? Read-only actions count (`getAssigneeAvailability`, `fetchRosterMonth`, `getUsageCounts`). Is there per-action authorization (role) once authenticated? IDOR on `/users/[userId]`, task/user ids.
2. **Input validation & mass assignment.** Every action must re-validate on the server (`*-validation.ts`): types, lengths, enums, existence of referenced ids, uniqueness, date sanity. Client-controlled discriminators (`kind`, `status`, `code`) must be allow-listed with `Object.hasOwn` — a plain-object lookup accepts `__proto__`/`constructor`. Check that updates can't overwrite immutable/internal fields (`id`, `code`, `parentId`, `createdAt`, keys/codes).
3. **Injection into the data store.** Values are written with `valueInputOption=RAW` (formulas not evaluated) — confirm no code path uses `USER_ENTERED`. Confirm table/range names passed to the API come only from constants (`SPECS`, `schema.ts`), never from user input; row targeting uses numeric indexes. CSV **export** must neutralise leading `= + - @` (`csv.ts`); CSV **import** must cap size/rows and validate every row before writing.
4. **XSS & unsafe rendering.** No `dangerouslySetInnerHTML`/`innerHTML`/`eval`. User text (titles, descriptions, names, labels, link labels) must only render as React text. URLs: `safeUrl` (http/https only) at **validation and render**; external links need `target="_blank" rel="noopener noreferrer"`. Check `href`/`src` built from stored values.
5. **SSRF / outbound requests.** The server must not fetch user-supplied URLs. `next/image` remote patterns limited to known hosts. User-supplied image URLs rendered via `<img>` leak the viewer's IP to the chosen host — note as privacy finding.
6. **Secrets.** Not in git or history; `.gitignore` covers `.env*`, `keys/`, credential files; `.env.example` has placeholders only (no real emails/project ids/ids); error messages describe problems without echoing secret values (`normalizeKey` reports lengths/markers only); nothing server-only imported into `"use client"` files.
7. **Error handling & information disclosure.** Server actions return generic messages and log details; pages show banners, not stack traces/digests with causes; no verbose errors in production responses. Dev-only leaks are noted but not severity-rated.
8. **Security headers & transport.** CSP, `X-Frame-Options`/`frame-ancestors` (clickjacking matters because admin actions have no auth), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader: false`. HSTS is normally added by the host — verify on the deployed URL if reachable. A new CSP must allow inline styles used by the app (`style-src 'unsafe-inline'`) and Next's inline scripts (nonce); test in a browser before shipping.
9. **Availability / abuse.** No rate limiting? Estimate store API calls per page load and per action (see `readTable` cache TTL, number of settings tables read per render, `MAX_CELLS`, import row cap). Can an anonymous loop exhaust the data-store quota and take the whole app down? Unbounded loops/inputs; large payloads.
10. **Confidentiality of the data store.** Source/docs/UI/messages/commits must not name the vendor (the sanctioned exceptions are listed in `CLAUDE.md`). Production HTML and `.next/static` bundles must contain no vendor strings or store identifiers. Git history may still hold old names/emails — report, don't rewrite history without the user's approval.
11. **Dependencies & supply chain.** `npm audit --omit=dev`; for each advisory decide whether the vulnerable feature is actually used (e.g. rewrites, image optimiser). Lockfile committed; no `postinstall` surprises; pinned major versions of framework packages.
12. **Data protection / PII.** What personal data is stored, rendered and exported? Is real staff data committed to the repo (seed `json/`)? Retention/deletion: does deleting a user remove dependent rows (roster, assignments)? Logs must not contain PII or secrets.
13. **Operational safety.** Destructive scripts (`seed:data` overwrites tables) need a guard/confirmation; migrations take backups; destructive UI actions confirm and state impact.
14. **Business-logic abuse.** Cascade/ordering (delete dependents before parents), in-use protection on settings, immutable keys, uniqueness races (two concurrent creates), subtask/parent rules, assignments to inactive users.

## 4. Verify, then rate
- Reproduce or trace each finding. For runtime claims, run the app (production build) and show the request/response or output.
- Severity: **Critical** (unauth data loss/takeover at scale) · **High** (unauth read of sensitive data/modify data, exploitable vuln) · **Medium** (needs conditions; meaningful risk) · **Low** (hardening/defence in depth) · **Info**.
- Calibrate to the deployment: internet-facing and unauthenticated ⇒ raise anything an anonymous visitor can do.

## 5. Report format
Write `docs/security-review-YYYY-MM-DD.md` (create `docs/` at repo root if needed) and summarise in chat:
```
# Security review — <date>
Scope · commit · method (scan + manual)
## Summary table  (ID | Severity | Title | Status)
## Findings
### H1 — <title>
- Where: path:line
- What/why it matters (impact in this app)
- Evidence (code or request/response)
- Fix (concrete, smallest change first) 
## Checked and OK  (controls verified, with where)
## Needs confirmation
## Recommended order of fixes
```
Keep it scannable: findings first by severity, each with a concrete fix. End by asking which fixes to apply. If asked to fix, do one finding per change, re-run `scan.sh`, run `npx tsc --noEmit` + `npm run build`, and update `README.md` (Changelog) and `CLAUDE.md` if a rule changes (documentation rule in `CLAUDE.md`).
