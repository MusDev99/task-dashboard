# Feature: Notifications (in-app inbox)

**Status:** ✅ verified in a real browser (fake Google + in-memory store) · **Branch:** `ccr-62221fdb-cy33y0`

## 1. 🧠 Brainstorm
**Problem** — approvers learn about leave requests only by opening the page; people learn about decisions and new task assignments by chance.

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. In-app inbox + unread badge | No new service or secret; works on the installed PWA | Only seen when the app is open | S–M | ✅ |
| B. Email | Reaches people outside the app | Needs a mail provider, sender domain, secrets, bounce handling | M | later |
| C. Web push | Reaches a locked phone | VAPID keys, subscription storage, service-worker changes (SW must not cache data) | L | later |

**Decision:** A first; the `notifyUsers` seam is where email/push would plug in.

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | Pure rules + tests (`lib/notifications.ts`) | ✅ |
| 2 | `notifications` table, best-effort recorder, own-only actions | ✅ |
| 3 | Hooks: leave requested / decided, task assigned | ✅ |
| 4 | Inbox page, menu badge + phone bell, polling | ✅ |
| 5 | Email / push, per-person mute, more events (roster change, team add) | ⬜ |

## 3. 🔬 Feature analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | A leave request notifies every active admin and planner and the lead of the requester's teams; never the requester | unit + e2e |
| AC-2 | A decision notifies the requester with the reason; the decider is not told about their own decision | e2e |
| AC-3 | Assigning a task (create, or change of assignee) notifies the new assignee unless they assigned it themselves | code path; recipients unit-tested (not browser-tested) |
| AC-4 | A person sees only their own notifications; marking read ignores ids that aren't theirs | e2e + unit |
| AC-5 | Badge = unread count; opening one marks only it read and goes to its page; *Mark all as read* clears the rest | e2e |
| AC-6 | A failure while notifying never fails the saved change | by design (try/catch, logged) |
| AC-7 | Links are in-app paths only; anything else falls back to the inbox | unit |
| AC-8 | Unread is shown by dot + "New" text, not colour alone; 375px: no horizontal scroll, rows ≥ 44px | e2e |
| AC-9 | Read notifications older than 30 days and anything beyond the newest 200 are removed on *Mark all as read* | unit |

**Data impact:** new lazy tab `notifications` (`NOTIFICATION_COLUMNS`); deleting a user deletes their rows. No migration. Rollback: ignore the tab.
**OWASP:** A01 the unread count, list and mark actions are keyed to the signed-in person (`requireActor()`), never to a client-supplied user id; A03 text cleaned to one line and capped, rendered as text, `href` validated (`safeInternalPath`) on write and on read, so a hand-edited row can't send people off-site; A09 failures logged server-side without payloads.
**Laws of UX:** Jakob (bell + badge), Hick (one list, one bulk action), Doherty (badge updates instantly via event, optimistic read state), Peak-End ("All caught up"), Fitts (44px rows, bell in the thumb zone of the top bar).

**Known limits:** inbox only (no email/push); the badge refreshes every minute (not instant for other people's events); no per-person mute; tab growth is bounded only when people press *Mark all as read*.

## 5–6. Verify / validate
`npm run verify` green; `node scripts/e2e/leave.e2e.mjs` 33 checks (member, planner, admin; desktop + 375px).
