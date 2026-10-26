# Feature: Mobile-first design for every module

**Status:** ✅ done · **Branch:** `ccr-e5a64c0c-wi5hcs` (agent session branch) · **Target version:** v0.4.0

## 1. 🧠 Brainstorm
Audit at 375px (production build, test data) found:

| Module | Problem (before) | Fix |
|---|---|---|
| All drawers | Rendered **under** the phone top bar + tab bar (z 100 vs 1000): title and Save button hidden | One stacking scale (bars 50 … drawers 100 … toasts 120) |
| Tasks list | 7-column table, horizontal scroll (scrollWidth 384) | Rows → cards via `grid-template-areas` |
| Tasks calendar | 7×120px grid in a sideways scroller; 81 tiny targets | Agenda list (from today, *Show earlier days*) |
| Tasks kanban | Lanes not snapping | One swipeable lane per screen (scroll-snap) |
| Tasks/Users/Teams | Full-width primary button at the top, 3 filter rows, 4 tall stat cards | FAB above the tab bar, *Filters · n* toggle, swipeable stat strip |
| Dialogs | Centered modal | Bottom sheet, 48px buttons, Cancel focused |
| Inputs | 14px → iOS zooms on focus | 16px on phones |

| Option | Pick |
|---|---|
| Separate mobile components per page | |
| **Shared CSS patterns (`fab`, `stats-compact`, `filter-group`, card tables) + small markup hooks** — no JS width checks, server HTML already right | ✅ |

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | Stacking scale fix (drawers/dialogs above shell) | ✅ |
| 2 | Shared patterns: FAB, stat strip (`StatCard`), filter toggle, full-screen drawers, sheet dialogs | ✅ |
| 3 | Tasks: card list, agenda calendar, snapping kanban | ✅ |
| 4 | Users/Teams/Dashboard compaction | ✅ |
| 5 | Docs, verify, browser pass | ✅ |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Phone, open any drawer → header and footer buttons visible and tappable | browser |
| AC-2 | Phone, `/tasks?view=list` → cards, no horizontal scroll | browser (scrollWidth 375) |
| AC-3 | Phone, calendar → agenda from today; *Show earlier days* reveals the rest | browser |
| AC-4 | Phone, *Filters* toggle shows selects; choosing one shows *Filters · 1* and updates the URL | browser |
| AC-5 | Phone, delete user → bottom-sheet confirm, Cancel focused | browser |
| AC-6 | Desktop → no FAB, no filter toggle, month grid calendar, table list (unchanged) | browser (1440px) |

| Law of UX | Applied |
|---|---|
| Fitts | FAB in the thumb zone; 44–48px targets; bottom-sheet actions |
| Hick | Filters folded behind one toggle; stats reduced to values |
| Jakob | FAB, bottom sheet, agenda, swipe lanes = native mobile patterns |
| Miller | Stat strip; agenda shows only days with tasks |
| Doherty | CSS-only switches: no extra renders or hydration flash |
| Aesthetic-Usability | One shared `StatCard`, consistent tokens |

OWASP: no server actions, inputs or endpoints changed (UI/CSS only).

## 5. 📏 Verify
- [x] `npm run verify` green · `npm audit --omit=dev` 0 vulnerabilities
- [x] No new `any`, hardcoded data or secrets

## 6. ✅ Validate
Playwright, production build, 375px + 1440px: AC-1…AC-6 pass; scrollWidth 375 on every module; no page errors.
