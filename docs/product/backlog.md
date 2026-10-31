# WM product backlog

Owner: Mustaqeem · Maintained with the `product-owner` skill · Last groomed: 2026-10-31
RICE = Reach (people/month) × Impact (0.5–3) × Confidence × ÷ Effort (person-weeks). Reach assumes ~40 active users (⚠️ assumption; replace with the real count).

| # | Item | Reach | Impact | Conf. | Effort | RICE | Status | Brief |
|---|---|---|---|---|---|---|---|---|
| 1 | **Role-based access (access levels, team-scoped leads)** | 40 | 3 | 90% | 0.5 *(slice 1)* / 2 *(all)* | 216 / 54 | ✅ ready for dev | [rbac](briefs/rbac.md) |
| 2 | My schedule (member home, 14 days, ICS) | 40 | 2 | 80% | 0.5 | 128 | 💡 blocked by #1 for member rollout | — |
| 3 | Coverage targets + heat strip on Roster | 5 | 3 | 80% | 1.5 | 8 | 💡 | — |
| 4 | Leave requests & approval | 40 | 3 | 80% | 3 | 32 | 💡 needs #1 | — |
| 5 | Shift patterns / rotation fill | 5 | 3 | 80% | 1.5 | 8 | 💡 | — |
| 6 | Rest-rule & fairness warnings | 5 | 2 | 80% | 1.5 | 5 | 💡 | — |

Rank by RICE first, then dependencies: #1 unlocks #2 and #4 for members. Planner-only items (#3, #5) have small reach but high value per planner, so re-score them after the user count is confirmed.

## Next release (MoSCoW)
- **Must:** #1 RBAC, slices 1–2 (server guard + read-only UI)
- **Should:** #1 slices 3–4 (lead scoping, member task status)
- **Could:** #2 My schedule
- **Won't (this release):** custom permission matrix, location-scoped access

**Outcome metric:** write actions with a permission check, from 0/18 to 18/18; members able to change others' data = 0.
