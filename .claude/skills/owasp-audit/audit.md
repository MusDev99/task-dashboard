# Security audit — <product>

**Date:** <YYYY-MM-DD> · **Auditor:** <name or Claude> · **Commit:** `<sha>` · **Target:** local build / preview URL
**Overall posture:** 🔴 high risk · 🟠 medium · 🟢 low  (pick one, justify in one line)

## 1. Scope & method
Attack surface (routes / endpoints / actions / env vars / outbound hosts), tools used, what was **not** tested.

## 2. OWASP Top 10 (2021) scorecard
| Risk | Status | Evidence | Fix / owner |
|---|---|---|---|
| A01 Broken access control | ✅ / ⚠️ / ❌ | | |
| A02 Cryptographic failures | | | |
| A03 Injection (incl. XSS, formula injection) | | | |
| A04 Insecure design | | | |
| A05 Security misconfiguration | | | |
| A06 Vulnerable & outdated components | | `npm audit --omit=dev`: N vulns | |
| A07 Identification & authentication failures | | | |
| A08 Software & data integrity failures | | | |
| A09 Logging & monitoring failures | | | |
| A10 SSRF | | | |

## 3. Findings
| ID | Sev | Title | Location | Evidence / repro | Fix | Status |
|---|---|---|---|---|---|---|
| F-01 | 🔴 / 🟠 / 🟡 / 🔵 | | `file:line` | | | open / fixed in `<sha>` / accepted |

## 4. Dependency audit
| Package | Severity | Direct? | Fix | Decision |
|---|---|---|---|---|

## 5. Headers & deployment checks
| Check | Expected | Actual |
|---|---|---|
| CSP, X-Frame-Options, nosniff, Referrer-Policy, HSTS (prod) | present | |
| Unauthenticated write | 401/403/307/503 | |
| Cross-origin write | 403 | |
| Secrets in git history | none | |

## 6. Remediation roadmap
| Phase | When | Tasks | Effort |
|---|---|---|---|
| 1 🔒 | now | | S |
| 2 🧱 | 1-2 weeks | | M |
| 3 🏗️ | quarter | | L |

## 7. Residual risk & accepted risk
Honest list of what is still exposed and why it is acceptable (or who must decide).

## 8. Sign-off
Next audit due: <date or trigger> · Approved by: <name>
