---
name: feature-checklist
description: Create and maintain the per-feature feature.md (brainstorm, roadmap, analysis, implementation checklist, verification gates, validation matrix). Use when starting a feature or when asked to validate a feature against its checklist.
---
# 📋 feature-checklist

1. Copy `.claude/skills/feature-checklist/feature.md` to `docs/features/<slug>/feature.md` (kebab-case slug, e.g. `auth-guard`).
2. Fill sections in order as the work progresses; set the **Status** line at the top (🧠 → 📐 → 🔨 → ✅ → 🚀).
3. Tick boxes only with evidence (command output, test name, screenshot path). An unticked box is either work left or a waiver written next to it.
4. Before commit: every box in §4-§7 is ticked or waived. The PR body links the file and pastes the §6 table.
5. Reference example in this repo: `docs/features/auth-guard/feature.md`.

Rules
- One feature.md per feature; small fixes use the "Fix" shortcut (sections 3-6 collapsed to one table).
- Acceptance criteria are testable sentences with IDs (`AC-1`), never "works well".
- OWASP and Laws-of-UX tables are mandatory, even if the answer is "n/a — reason".
- Mobile (375px) is a first-class criterion, not an afterthought.
