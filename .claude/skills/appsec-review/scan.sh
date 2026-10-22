#!/usr/bin/env bash
# Automated first pass for the appsec-review skill. Read-only: never opens secret files,
# never prints secret values. Run from the repo root:  bash .claude/skills/appsec-review/scan.sh
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PORT="${SCAN_PORT:-3099}"
h() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

h "1. Server actions (each is a PUBLIC endpoint; argument values are attacker-controlled)"
grep -n "^export async function" lib/*-actions.ts 2>/dev/null | sed 's/(.*//' || true

h "2. Authentication layer present?"
if ls middleware.ts proxy.ts src/middleware.ts src/proxy.ts >/dev/null 2>&1; then echo "middleware/proxy file found - review it"; else echo "NO middleware/proxy file"; fi
if grep -rEn "getServerSession|auth\(\)|cookies\(\)|jwtVerify|requireRole|requireAuth" app lib --include=*.ts --include=*.tsx >/dev/null 2>&1; then
  grep -rEn "getServerSession|auth\(\)|cookies\(\)|jwtVerify|requireRole|requireAuth" app lib --include=*.ts --include=*.tsx | head
else echo "NO session/authorization calls found in app/ or lib/"; fi

h "3. Dangerous sinks"
grep -rEn "dangerouslySetInnerHTML|\.innerHTML|eval\(|new Function|document\.write|child_process|execSync|spawn\(" app lib scripts --include=*.ts --include=*.tsx || echo "none"

h "4. Client-controlled lookups that may accept prototype keys (SPECS[kind] style)"
grep -rEn "\b[A-Z_]{3,}\[[a-z]+\]" lib --include=*.ts | grep -v "Record<" | head -10 || true
echo "(each hit: is the key allow-listed with Object.hasOwn / a switch with default-reject?)"

h "5. Data-store writes: formula evaluation must stay off (RAW only)"
grep -rn "USER_ENTERED" lib scripts || echo "no USER_ENTERED: OK"

h "6. External URL handling / outbound requests"
grep -rn "fetch(" app lib --include=*.ts --include=*.tsx | grep -v "^lib/store.ts" || echo "no fetch outside lib/store.ts: OK"
grep -rn "dangerouslyAllowSVG\|remotePatterns" next.config.* || true
grep -rn "<img " app --include=*.tsx | head -5

h "7. Secrets: tracked files that look like credentials"
git ls-files | grep -E "^keys/|credentials|service-account|\.pem$|\.p12$|^\.env($|\.)" | grep -v "\.env\.example" || echo "no credential-like files tracked: OK"
echo "-- private-key bodies (long base64) in tracked files:"
git ls-files | grep -vE "package-lock|\.svg$|\.ico$|\.png$|\.webp$" | xargs grep -lIE "[A-Za-z0-9+/]{250,}" 2>/dev/null || echo "none: OK"
echo "-- history: key markers added in any commit (placeholders show up here; inspect each):"
git log --all --oneline -S"PRIVATE KEY-----" 2>/dev/null | head -5 || true
echo "-- .gitignore protects secrets?"
for p in "keys/" ".env" "service-account"; do grep -q "$p" .gitignore && echo "ignored: $p" || echo "MISSING in .gitignore: $p"; done
echo "-- .env.example contains anything that looks like a real value (emails/ids)?"
grep -nE "[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|[0-9]{8,}" .env.example | grep -v "example\." || echo "placeholders only: OK"

h "7b. Personal data committed to the repo (seed/fixtures)"
git ls-files json | while read -r f; do
  n=$(grep -cE "[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[a-z]{2,}" "$f" 2>/dev/null || true)
  [ "${n:-0}" -gt 0 ] && echo "$f: $n lines containing email addresses (real staff data?)"
done; true

h "8. Dependency audit (production)"
npm audit --omit=dev 2>&1 | grep -E "^[a-z@].* (high|critical|moderate)|Severity|vulnerabilities|fix available" | head -20 || true
echo "next version: $(node -p "require('next/package.json').version" 2>/dev/null)"

h "9. Vendor/store-name leaks (confidentiality rule) in source, docs, messages"
LEAK_RE="google ?sheets?|gsheet|sheets\.googleapis|spreadsheets?/d/"
grep -rInEi "$LEAK_RE" app lib scripts README.md CLAUDE.md .env.example package.json netlify.toml next.config.ts 2>/dev/null \
  | grep -v "^lib/store.ts" | head -10 || true
echo "(only lib/store.ts may contain endpoint/legacy-variable strings; anything listed above is a leak)"

h "10. Production build: headers and vendor strings in browser output"
if [ "${SKIP_BUILD:-0}" = "1" ]; then echo "SKIP_BUILD=1: skipped"; else
  if lsof -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then echo "NOTE: something listens on :3000 (dev server?). Stop it first - building under a running dev server corrupts it."; fi
  if npx next build >/tmp/appsec-build.log 2>&1; then
    (npx next start -p "$PORT" >/tmp/appsec-start.log 2>&1 &) ; sleep 5
    echo "-- response headers:"
    HDRS=$(curl -sI "localhost:$PORT/" 2>/dev/null)
    for hdr in content-security-policy x-frame-options x-content-type-options referrer-policy permissions-policy strict-transport-security x-powered-by; do
      line=$(printf '%s' "$HDRS" | grep -i "^$hdr:" | head -1)
      if [ "$hdr" = "x-powered-by" ]; then [ -n "$line" ] && echo "PRESENT (should be removed): $line" || echo "ok  : x-powered-by absent"
      else [ -n "$line" ] && echo "ok  : $line" || echo "MISSING: $hdr"; fi
    done
    echo "-- vendor strings in served pages and browser bundles:"
    for p in / /tasks /users /roster /settings; do
      n=$(curl -s "localhost:$PORT$p" | grep -oEi "googleapis|google ?sheets?|spreadsheets" | wc -l | tr -d ' ')
      echo "page $p: $n"
    done
    n=$(grep -rlEi "googleapis|spreadsheets" .next/static 2>/dev/null | wc -l | tr -d ' '); echo "static bundles: $n files"
    echo "-- anonymous access (no auth): status codes"
    for p in / /users /roster /tasks /settings; do printf '%s -> %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "localhost:$PORT$p")"; done
    pkill -f "next start -p $PORT" 2>/dev/null; true
  else echo "build failed - see /tmp/appsec-build.log"; tail -5 /tmp/appsec-build.log; fi
fi
printf '\nDone. Verify each lead in code before reporting (see SKILL.md).\n'
