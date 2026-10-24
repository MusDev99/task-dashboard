---
name: owasp-audit
description: Security audit against the OWASP Top 10 (2021) for this repo, producing an audit.md with evidence, severity and a remediation roadmap. Use before a release, after adding endpoints/auth/dependencies, or when asked for a security review or hardening pass.
---
# 🛡️ owasp-audit

Authorized, defensive review of THIS repository and its own deployments only.

Method
1. **Map the attack surface**: list routes, API handlers, server actions, env vars, outbound hosts (`grep -rn "fetch(\|process.env" src app lib`). Auth lives in `proxy.ts`, `lib/auth-core.ts`, `lib/auth.ts`, `lib/auth-actions.ts`, `requireSession()` in every `lib/*-actions.ts` export.
2. **Static checks**: secrets (`git log --all -p -S"BEGIN PRIVATE KEY"`, `.gitignore` covers `.env*`/keys), `any`/`eval`/`dangerouslySetInnerHTML`/`set:html`, unvalidated input, error messages that leak internals.
3. **Dependencies**: `npm audit --omit=dev`; apply non-breaking fixes with `npm audit fix`, verify with `npm run verify`; record major upgrades as roadmap items, never `--force` blindly.
4. **Dynamic checks** (local build or a preview URL, never someone else's site): `npm run smoke -- <url>`; curl each write endpoint without a session (expect 401/403/307/503), cross-origin POST (expect 403), tampered cookie (expect rejection), `curl -I` for headers.
5. **Write the report** from `.claude/skills/owasp-audit/audit.md` to `docs/audits/<YYYY-MM-DD>-audit.md`. Every finding has evidence and a fix owner; fixed items link the commit.
6. Re-run step 4 after fixes and update statuses. Residual risk must be stated honestly.

Do not: exfiltrate data, brute-force real accounts, load-test production, or test third-party services.
