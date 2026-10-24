---
name: code-review-checklist
description: Repo-specific code review (correctness, OWASP, Laws of UX, mobile, performance, conventions, tests, docs) that writes a code-review.md report with severities. Use before every PR/merge, or when asked to review a branch, diff or file.
---
# 🔍 code-review-checklist

Scope: the diff against the base branch (`git diff main...HEAD`) plus the files it touches. Read the whole changed function, not just the hunk.

Steps
1. Read `CLAUDE.md` and the branch's `docs/features/<slug>/feature.md` (the intent and ACs).
2. Run `npm run verify`; any failure is a 🔴 finding.
3. Walk the checklist in `.claude/skills/code-review-checklist/code-review.md`; only report what you verified in code (cite `file:line`).
4. Write the report to `docs/reviews/<branch-or-pr>.md` using that template; paste the summary table in the PR.
5. Fix 🔴/🟠 findings before merge; 🟡/🔵 may ship with a tracked follow-up.

Severity: 🔴 blocker (bug, security hole, data loss, build/test red) · 🟠 major (likely bug, missing auth/validation, a11y/mobile break) · 🟡 minor (maintainability, naming) · 🔵 nit.
Be specific: failing input -> wrong output, plus the smallest fix. No style opinions that CLAUDE.md does not back.
