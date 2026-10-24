---
name: release
description: Git strategy and release management (branching, Conventional Commits, PRs, SemVer, changelog, tags, deploy previews, smoke tests, rollback). Use when committing, opening a PR, cutting a version, or deploying.
---
# 🚀 release — git strategy & release management

## 🌿 Git strategy
| Rule | Detail |
|---|---|
| Never commit to `main` | Work on a branch, merge by PR (squash or merge commit; no force-push to `main`) |
| Branch names | `feat/<kebab>` · `fix/<kebab>` · `chore/<kebab>` · `docs/<kebab>` (cloud/agent sessions may be given a fixed branch: use it) |
| Commit style | Conventional Commits: `feat(roster): ...`, `fix(auth): ...`, `docs:`, `chore:`, `test:`, `refactor:`; imperative, one logical change each |
| Commit only when asked | Run `npm run verify` first; never `--no-verify`; never commit `.env*`, keys, `node_modules` |
| Docs in the same commit | CHANGELOG/README (and CLAUDE.md when a rule changes). Add a one-line entry at the top of the README `## Changelog`. |
| PR body | What/why, link to `docs/features/<slug>/feature.md`, risk + rollback, test evidence, mobile + desktop screenshots, Laws of UX applied |
| Review | Run `code-review-checklist` and attach `docs/reviews/...`; run `owasp-audit` when auth, endpoints, deps or headers changed |

## 🏷️ Versioning (SemVer, `package.json`)
| Change | Bump | Example |
|---|---|---|
| Breaking (sheet schema change needing migration, removed route, new required env var) | MAJOR | 1.0.0 -> 2.0.0 |
| New feature, backward compatible | MINOR | 1.2.0 -> 1.3.0 |
| Fix, security patch, docs | PATCH | 1.2.0 -> 1.2.1 |

A new **required** env var (e.g. auth secrets) is a deploy-time breaking change: call it out at the top of the release notes.

## 📦 Release checklist
| # | Step | Command / evidence |
|---|---|---|
| 1 | Main is green and up to date | `git switch main && git pull` |
| 2 | Verify | `npm run verify` and `npm audit --omit=dev` |
| 3 | Audit if security-relevant | `owasp-audit` -> `docs/audits/...` |
| 4 | Bump version + changelog | `npm version <patch\|minor\|major> --no-git-tag-version`; move entries under the new version |
| 5 | Release PR + tag | `git tag -a vX.Y.Z -m "vX.Y.Z"` after merge; push tag |
| 6 | Deploy **preview** first | Netlify: env vars scoped to Functions (`GOOGLE_*`, `ADMIN_PASSWORD`, `AUTH_SECRET`); deploy preview opens `/login`; `npm run smoke -- <preview-url>` is green. |
| 7 | Smoke test the preview | `npm run smoke -- https://<preview-url>` all ✅ |
| 8 | Promote to production, smoke again | same command against production |
| 9 | GitHub Release notes | highlights, breaking/env changes, upgrade steps, rollback |
| 10 | Watch for 30 min | host logs for 5xx / auth failures |

## ⏪ Rollback
Netlify → Deploys → pick the last good deploy → **Publish deploy**. Vercel → Deployments → **Promote** / Instant Rollback. Data rollback: sheet tabs have no transactions: before a schema migration duplicate the tab (`users_backup_YYYYMMDD`).

## Hotfix
Branch `fix/<name>` from the latest tag, PATCH bump, same checklist with only steps 2, 5-8, then merge back to `main`.
