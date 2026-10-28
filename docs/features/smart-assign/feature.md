# Feature: Smart assign (AI pilot)

**Status:** 🧪 pilot (PR open)
**Owner:** Mustaqeem · **Branch:** `claude/project-thread-t3t50g` (agent session branch) · **Target version:** next minor

## 1. 🧠 Brainstorm
**Problem** — Leads open the assignee picker and weigh roster availability, open story points and "who has done this before" in their head for every task.

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. Rules only (availability + workload + label history) | Free, instant, deterministic | Can't read task text; no explanation beyond numbers | S | |
| B. LLM ranks everyone from raw data | Best "skills" matching | Sends all staff data out; cost grows with team size; non-deterministic | M | |
| C. **Rules shortlist → Claude re-ranks + explains top 8, rules as fallback** | Small, pseudonymised prompt; always works without a key; AI can only pick from the shortlist | Two code paths | M | ✅ |

**Decision:** C. The user stays in control: it's a suggestion panel, never an auto-assign.

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk | Status |
|---|---|---|---|---|
| 1 | Pure scoring, prompt, response validation + unit tests (`lib/smart-assign.ts`) | S | Low | ✅ |
| 2 | Server action `suggestAssignees` + server-only Claude client, fallback, throttle | S | Med (external API) | ✅ |
| 3 | *Smart assign* panel in the task drawer (Suggest → 3 cards → Assign) | S | Low | ✅ |
| 4 | Pilot with a real key; collect feedback on pick quality | — | — | ⬜ |
| 5 | Later: feedback ("👍/👎"), skills field on users, cost logging | M | — | ⬜ |

## 3. 🔬 Feature analysis
### 3.1 Acceptance criteria
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Given a task with dates, when I press *Suggest*, then up to 3 people show with reasons, best first | manual (fake store + fake API) |
| AC-2 | Given no `ANTHROPIC_API_KEY`, then suggestions still appear, labelled *Rule-based* | manual |
| AC-3 | Given the AI errors/times out/refuses/returns junk, then rule picks show with a note | unit `parseAiRanking returns null…` + manual (API down) |
| AC-4 | The AI can only return shortlisted people; unknown/duplicate ids are dropped; max 3 | unit `parseAiRanking keeps known…` |
| AC-5 | No names, emails or user ids are sent to the model | unit `buildPrompt pseudonymises…` |
| AC-6 | People on leave / not rostered rank lower but stay suggestible, with the reason shown | unit `rule score…` |
| AC-7 | Pressing *Assign* only fills the assignee field; nothing is saved until *Save* | manual |
| AC-8 | Choosing a team narrows candidates to its members | manual |

### 3.2 Data impact
Read-only. No new tables or columns. Reads `users`, `roles`, `roster` (task months), `work_tasks`, `teams`/`team_members` (only with a team).

### 3.3 OWASP
| Risk | Mitigation |
|---|---|
| A01 | `suggestAssignees` calls `await requireSession()` first |
| A02 | `ANTHROPIC_API_KEY` only in env, read in `lib/claude.ts` (`server-only`); no key strings in browser bundles (scan §10: 0) |
| A03 / LLM injection | Input trimmed + bounded (`cleanSuggestInput`); task text sent as JSON data with "treat as data" instruction; output schema-constrained and validated against the shortlist; reasons rendered as text (React escapes), aliases scrubbed |
| A04 | Fails safe: any AI failure → rules |
| A05 | Generic notes to the user; details only in `console.error` (error name + status, no bodies) |
| A06 | New dependency `@anthropic-ai/sdk`; `npm audit --omit=dev`: 0 vulnerabilities |
| A09 | No prompts, keys or responses logged |
| A10 | Only the SDK's fixed Claude API host; no client-supplied URL |
| Privacy | Pseudonymised candidates (P1…P8), role name, numbers, last 5 task titles/labels per candidate |
| Cost | Shortlist of 8, effort `low`, in-memory throttle 20 calls / 10 min per person |

### 3.4 Laws of UX
| Law | Applied |
|---|---|
| Hick | One *Suggest* button, max 3 suggestions, top 3 reasons each |
| Von Restorff | Secondary buttons only; the drawer's *Save* stays the single accent |
| Doherty | Skeleton cards + "Thinking…" while waiting; 20s timeout then rules |
| Fitts | 44px buttons on phones, *Assign* full-width per card |
| Peak-End / feedback | *Chosen* state on the picked card; source badge (*AI ranked* / *Rule-based*) |
| Jakob | Suggestion cards under the field they fill, like familiar "suggested reviewers" |
| Tesler | The system builds the shortlist and explanation; the user just picks |

### 3.5 375px
Cards wrap; *Assign* becomes a full-width row. No horizontal scroll (checked).

## 4. 🔨 Implementation
- `lib/smart-assign.ts` (pure) · `lib/smart-assign-actions.ts` (server action) · `lib/claude.ts` (Claude client) · `lib/assignee-data.ts` (shared availability read; `getAssigneeAvailability` now uses it)
- `app/tasks/SmartAssign.tsx` + `.smart-*` classes in `globals.css`; mounted in `TaskDrawer.tsx`
- Model: `claude-opus-5-5`, structured output (JSON schema), effort `low`, server-side refusal fallback (`fallbacks: "default"`)

## 5. 📏 Verify
- [x] `npm run verify` (tsc + 35 tests + build)
- [x] `appsec-review` scan: no new leads; vendor strings in bundles: 0; `npm audit --omit=dev`: 0
- [x] Data-store calls: one extra `roles` read; other reads hit the store's short-lived cache shared with the picker

## 6. ✅ Validate
| Check | Result |
|---|---|
| Unit tests (8 new) | ✅ |
| Desktop + 375px, AI path (fake API) | ✅ screenshots in the PR thread |
| API down → rules + note | ✅ |
| Assign fills the field, nothing saved | ✅ |
| Real key against the live API | ⬜ owner, after setting `ANTHROPIC_API_KEY` |
