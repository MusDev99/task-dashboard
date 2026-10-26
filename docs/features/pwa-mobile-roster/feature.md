# Feature: PWA + mobile-first roster + leaderboard removal + performance

**Status:** ✅ done · **Branch:** `ccr-e5a64c0c-wi5hcs` (agent session branch) · **Target version:** v0.3.0

## 1. 🧠 Brainstorm
| Option (mobile roster) | Pros | Cons | Pick |
|---|---|---|---|
| A. Keep the month grid, just bigger cells | No new code | 31 columns at 375px = sideways scrolling, tiny targets | |
| B. Agenda list (month × people) | Vertical | 31 × N rows, slow to scan one day | |
| C. **Day view**: day strip + one row per person + bottom-sheet picker; Month grid one tap away | Thumb-reachable, 60px rows, "who works today" at a glance | Range edits stay in the grid | ✅ |

| Option (PWA caching) | Pick |
|---|---|
| Cache pages (offline roster) — leaks private staff data on shared phones, stale data | |
| **App-shell only**: hashed build assets + icons, offline fallback page | ✅ |

Leaderboard: remove route, nav item, dashboard widgets, merit score on Users/profile and the reads of the legacy `tasks` table. Keep the table + its cleanup on user delete (no dangling rows).

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk | Status |
|---|---|---|---|---|
| 1 | Remove leaderboard + merit + dead CSS/types/readers | S | Low | ✅ |
| 2 | CSS-only app shell (no JS width check), bottom tab bar, safe areas | S | Low | ✅ |
| 3 | PWA: manifest, icons, SW, offline page, proxy + headers | S | Med (auth/CSP) | ✅ |
| 4 | Roster Day view, bottom-sheet picker, ⋮ menu on phones | M | Low | ✅ |
| 5 | Perf: memoised grid rows, stable callbacks, memoised stats, cheaper CSS | S | Low | ✅ |
| 6 | Docs, tests, security scan, browser pass | S | Low | ✅ |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Phone width, open `/roster` → Day view for today, `?day=` in URL | browser (375px) |
| AC-2 | Tap a person → bottom sheet → pick code → toast + row updates; failure rolls back | browser |
| AC-3 | Next/prev day, swipe, arrow keys on the day strip change the day | browser |
| AC-4 | Desktop `/roster` → Month grid; drag a range → anchored popover; arrows move focus | browser |
| AC-5 | `/leaderboard` → 404; no leaderboard/merit in nav, dashboard, users, profile | browser + grep |
| AC-6 | `manifest.webmanifest`, `sw.js`, icons load without a session; SW activates in prod | curl + browser |
| AC-7 | Pages/server actions never come from the SW cache | code review (`sw.js`) |
| AC-8 | No horizontal scroll at 375px on roster/users | browser (scrollWidth = 375) |
| AC-9 | `monthDays` labels/weekends/today correct, leap year | unit `roster-days.test.ts` |

| OWASP | Risk | Mitigation |
|---|---|---|
| A01 | New public paths | Only static files (manifest, sw.js, offline.html, icons) excluded in `proxy.ts`; no data |
| A05 | CSP | `worker-src 'self'`, `manifest-src 'self'` added explicitly |
| A04/A09 | Cached private data | SW never caches navigations/actions; offline page is static |

| Law of UX | Applied |
|---|---|
| Fitts | Bottom tab bar + bottom sheet within thumb reach; rows 60px, buttons ≥ 44px |
| Hick | Export/Upload/Clear in one ⋮ menu on phones; one day at a time |
| Jakob | Standard bottom tabs, bottom sheet, day strip (calendar-app pattern) |
| Miller | Day head-count per code instead of a 31-column wall |
| Doherty | Optimistic edits; memoised rows keep drag/edit at 60fps |
| Von Restorff | Selected day and today stand out; red only for Clear |
| Peak-End | Toast names what changed |

## 4. 🔨 Implementation
- [x] `app/roster/DayView.tsx`, `app/roster/days.ts`, memoised `RosterRow` in `RosterGrid.tsx`
- [x] `CellPicker` bottom sheet ≤ 768px; `RosterClient` view switch + URL mirror
- [x] `Sidebar.tsx` CSS-driven + bottom nav; `ServiceWorker.tsx`; `app/manifest.ts`; `public/sw.js`, `offline.html`, `icons/`
- [x] Leaderboard/merit removed; `loadDirectory`/`getTasks`/`TaskCompletion` dropped

## 5. 📏 Verify
- [x] `npm run verify` (tsc + 27 tests + build) green
- [x] `npm audit --omit=dev`: 0 vulnerabilities; appsec scan: no new findings, headers OK
- [x] Perf: data-store reads per page — Users reads `users` only (legacy `tasks` read dropped), Profile 4 → 1 users read, Dashboard drops the `tasks` read
- [x] Private app: `robots: noindex` kept

## 6. ✅ Validate
Browser pass (Playwright, production build, test data store with 12 people): AC-1…AC-8 passed at 375px and 1440px; no console errors (only the expected 404 for `/leaderboard`).
