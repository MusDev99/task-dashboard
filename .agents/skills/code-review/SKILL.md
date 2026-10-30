---
name: code-review
description: Reviews a diff, branch or PR against a shared 7-area checklist (intent, readability, tests, security, performance, style, docs) and reports findings by severity. Use before opening or merging a PR, or when asked to review code.
---

# 🔍 Code review

Shared checklist for every MusDev99 repo. The repo's own `CLAUDE.md` / `AGENTS.md` rules win where they are stricter. If a more specific review skill or a `repo-checks.md` sits next to this file, walk it too.

## ▶️ Steps

1. **Scope**: `git diff <base>...HEAD --stat` (base = `main`, or `master` where it is still the default). Read each changed file in full, not only the hunks.
2. **Intent**: read the PR description, linked issue or `docs/features/<slug>/feature.md`.
3. **Gate**: run the repo's check (`npm run verify`, `npm test`, `scripts/validate.sh`, see `CLAUDE.md`). A red gate is a 🔴 finding; paste the failing output.
4. **Checklist**: walk the 7 areas below. Report only what you verified in code, with `file:line`.
5. **Report** in the format at the bottom.

## ✅ Checklist

### 🎯 1. Functionality & Intent
- [ ] Does what the story / feature asks; trace one realistic input end to end.
- [ ] Edge cases, error handling and null / empty states are covered.
- [ ] Concurrency, race conditions and async logic are safe (if applicable).

### 📖 2. Readability & Simplicity
- [ ] Clean, modular, easy for another developer to follow.
- [ ] No over-engineering or abstractions without a second caller.
- [ ] Clear, descriptive names for variables, functions and classes.
- [ ] Non-obvious logic has a short comment explaining *why*, not *what*.

### 🧪 3. Testing
- [ ] New or changed behaviour has unit / integration / e2e tests, including failure paths.
- [ ] All test suites and CI pipelines pass. No skipped, disabled or weakened tests.

### 🔒 4. Security & Compliance
- [ ] No injection, hardcoded secrets or missing input validation.
- [ ] Access control, authentication and data-privacy rules are respected.
- [ ] Complies with relevant legal and organisational rules.

### ⚡ 5. Performance & Resources
- [ ] No memory leaks, infinite loops or unoptimised queries (e.g. N+1).
- [ ] CPU, memory and network calls are used efficiently.

### 🎨 6. Style & Consistency
- [ ] Follows the team / language style guide.
- [ ] Formatting, lint and static analysis run clean, without warnings.
- [ ] Matches the existing architecture and patterns of the codebase.

### 📝 7. Documentation
- [ ] Public APIs, config options and user-facing changes are documented (README, CHANGELOG, `.env.example`).

## 🚦 Severity

| Level | Meaning | Merge? |
|---|---|---|
| 🔴 Blocker | Bug, security hole, data loss, red gate | Fix first |
| 🟠 Major | Likely bug, missing test / validation, broken a11y or mobile | Fix first |
| 🟡 Minor | Readability, naming, small inefficiency | Follow-up OK |
| 🔵 Nit | Taste; only if the repo style backs it | Optional |

Be specific: failing input → wrong output, then the smallest fix. No style opinions the repo's rules don't back.

## 📋 Output

```
## 🔍 Review: <branch or PR>
Gate: ✅ <command> passed | ❌ failed (output below)

| # | Sev | Area | Location | Finding | Fix |
|---|-----|------|----------|---------|-----|
| 1 | 🔴 | 🔒 Security | api/x.ts:42 | ... | ... |
| 2 | 🟡 | 📖 Readability | src/y.ts:10 | ... | ... |

👍 Solid: <one line>
Verdict: ✅ approve | 🔁 request changes
```
