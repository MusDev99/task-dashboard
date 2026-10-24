---
name: dev-workflow
description: AI-driven development pipeline for this repo (brainstorm, plan, feature analysis, implement, verify, validate, git, release). Use at the START of any feature, fix or refactor, and whenever asked how to approach a change. Orchestrates feature-checklist, code-review-checklist, owasp-audit and release.
---
# 🧭 AI-driven development workflow — WorkForce Management (Next.js 16 + managed data store)

Every change walks the 8 gates below. Do not skip a gate; leave the artifact. Stop and ask the owner at 🛑.
Keep chat output concise: tables, emoji status, roadmaps (owner preference).

| # | Gate | What you do | Artifact | Exit criteria |
|---|---|---|---|---|
| 1 | 🧠 Brainstorm | Frame the problem, list 2-4 options in a comparison table, recommend one | `feature.md` §1 | Decision + rationale written 🛑 owner confirms if scope/UX changes |
| 2 | 🗺️ Plan | Roadmap table: phases, tasks, effort, risk | `feature.md` §2 | Smallest shippable slice first |
| 3 | 🔬 Feature analysis | Acceptance criteria (Given/When/Then), data impact, OWASP threat table, Laws-of-UX table, 375px notes | `feature.md` §3 | Every AC has an ID; every relevant OWASP row has a mitigation |
| 4 | 🔨 Implement | Smallest diff that satisfies the ACs; reuse before adding; follow CLAUDE.md | code + `feature.md` §4 ticks | `npm run build` compiles |
| 5 | 📏 Verify | Performance, SEO, quality, constraints (see below) | `feature.md` §5 | All gates ticked or waived with a reason |
| 6 | ✅ Validate | Unit tests for new logic + walk the feature.md checklist in a real browser (375px and desktop) | `feature.md` §6 table | Every AC maps to a passing test or manual step |
| 7 | 🌿 Git | Branch, focused commits, CHANGELOG/README, PR | commits + PR body | `npm run verify` green before commit |
| 8 | 🚀 Release | Version bump, tag, deploy preview, smoke test, rollback plan | `release` skill | Smoke test green on the preview, then production |

## Gate 5 detail — verify
**Performance**
- Data-store calls per page/action: count them (log in dev). Use the batch helpers (`upsertRowsById`, `deleteRowsByIds`); never loop single-row calls.
- Reads stay `force-dynamic`; do not add uncached full-tab reads inside loops.
- `npm run build` route table: no route unexpectedly static/dynamic; note the largest client chunk before/after.
- Interaction budget: Doherty < 400ms (debounce 250ms, optimistic updates, skeletons).

**SEO / discoverability**
- Private app: every page must stay `robots: noindex` (set in `app/layout.tsx`); no sitemap. Check `<title>` is meaningful per route and `lang="en"` is set.
- Accessibility is the SEO-equivalent here: labels on inputs, one `h1` per page, focus ring, `aria-*` per CLAUDE.md.

**Quality**
- `npm run verify`
- No `any`, `@ts-ignore`, stray `console.log`, secrets, commented-out code or TODOs without an owner.
- Lighthouse (mobile) when UI changed: `npx lighthouse http://localhost:3000/login --only-categories=performance,accessibility,best-practices --form-factor=mobile --chrome-flags="--headless"   # /login is the only public page`. Targets: performance >= 90, accessibility >= 95, best-practices >= 95.

**Constraints** (re-read `CLAUDE.md`, tick each that applies)
- OWASP: new endpoint/action is authenticated, input validated server-side, errors are generic, output encoded.
- Laws of UX applied and noted in the PR; touch targets >= 44px; no horizontal scroll at 375px.
- Data rules: - Data access only via `lib/store.ts`; every `"use server"` export calls `await requireSession()` first. - Writes use `RAW`; trim + validate on the server (`lib/validation.ts`); deleting order never leaves dangling refs.
- Docs updated in the same change (README, CLAUDE.md if a rule changed).

## Gate 6 detail — validate
`tests/*.test.ts` run with `node --test` (Node 22+, no extra deps). Pure logic in `lib/` is the first thing to cover: `validation`, `capacity`, `whereabouts`, `roster-validation`. Server actions are verified through the browser/manual matrix in feature.md.
- Add a failing test first for every bug fix; keep tests deterministic (inject time/randomness).
- Browser pass: empty, error, loading, keyboard-only, 375px and desktop. Delete only the test rows you created in the data store.

## Gate 7/8 — see the `release` skill
Branch naming, commit style, versioning and rollback live there so this file stays short.

## When something fails
Fix the root cause, re-run the failed gate and every gate after it. Never weaken a test, skip a check or disable a rule to get green. Report failures with the real output.
