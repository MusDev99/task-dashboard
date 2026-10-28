"use server";

import { currentUser, requireSession } from "./auth";
import { loadTeams } from "./actions";
import { loadAssigneeData } from "./assignee-data";
import { getRoles } from "./settings";
import { createRateLimiter } from "./auth-core";
import { aiConfigured, completeJson } from "./claude";
import { AI_SCHEMA, AI_SYSTEM, HISTORY, SHORTLIST, SUGGESTIONS, buildPrompt, cleanSuggestInput, parseAiRanking, rankByRules, type Candidate, type SuggestInput, type SuggestResult } from "./smart-assign";

// Best-effort cap on model calls per person (in-memory, per instance). Past it, the rules still answer.
const aiLimiter = createRateLimiter(20, 10 * 60_000);

/**
 * Suggests up to 3 assignees for a task (the drawer's unsaved form). Read-only: never assigns anyone.
 * Rules always run; with ANTHROPIC_API_KEY set, Claude re-ranks and explains the rules' shortlist.
 */
export async function suggestAssignees(raw: Partial<Record<keyof SuggestInput, unknown>>): Promise<SuggestResult> {
  await requireSession();
  const input = cleanSuggestInput(raw ?? {});
  try {
    const [{ users, tasks, tasksError, list }, roles, teamData] = await Promise.all([
      loadAssigneeData(input.startDate, input.dueDate, input.taskId),
      getRoles(),
      input.teamId ? loadTeams() : Promise.resolve(null),
    ]);
    const members = input.teamId && teamData ? new Set(teamData.members.filter((m) => m.teamId === input.teamId).map((m) => m.userId)) : null;
    const roleName = new Map(roles.map((r) => [r.id, r.name]));
    const userById = new Map(users.map((u) => [u.id, u]));
    const candidates: Candidate[] = list
      .filter((a) => !members || members.has(a.userId))
      .map((a) => {
        const u = userById.get(a.userId);
        const history = tasks
          .filter((t) => t.assigneeId === a.userId && t.id !== input.taskId)
          .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
          .slice(0, HISTORY)
          .map((t) => ({ title: t.title, labels: t.labels }));
        return { userId: a.userId, name: u?.name ?? "", role: u?.roleId ? roleName.get(u.roleId) ?? null : null, availability: a, history };
      });
    if (!candidates.length) return { source: "rules", suggestions: [], note: members ? "No active members in this team." : "No active people to suggest." };

    const ranked = rankByRules(candidates, input);
    const rules = new Map(ranked.map((s) => [s.userId, s]));
    const fallback = (note: string | null): SuggestResult => ({ source: "rules", suggestions: ranked.slice(0, SUGGESTIONS), note });

    if (!aiConfigured()) return fallback(null);
    if (!input.title) return fallback("Add a title to get AI suggestions.");
    if (tasksError) return fallback("Workload couldn't be loaded; showing availability-based picks.");
    const who = await currentUser();
    if (!aiLimiter.take(who?.uid ?? "local")) return fallback("AI suggestions are paused for a few minutes; showing rule-based picks.");

    const byId = new Map(candidates.map((c) => [c.userId, c]));
    const shortlist = ranked.slice(0, SHORTLIST).map((s) => byId.get(s.userId)!);
    const { aliases, user } = buildPrompt(input, shortlist, rules);
    try {
      const json = await completeJson(AI_SYSTEM, user, AI_SCHEMA as unknown as Record<string, unknown>);
      const picks = json ? parseAiRanking(json, aliases, rules) : null;
      return picks ? { source: "ai", suggestions: picks, note: null } : fallback("AI had no answer; showing rule-based picks.");
    } catch (e) {
      // A09: log the failure server-side without request bodies or keys.
      const status = e instanceof Error && "status" in e ? ` ${String(e.status)}` : "";
      console.error(`smart-assign: AI ranking failed (${e instanceof Error ? e.name : "error"}${status})`);
      return fallback("AI is unavailable right now; showing rule-based picks.");
    }
  } catch (e) {
    console.error("smart-assign: could not load data", e);
    return { source: "rules", suggestions: [], note: "Couldn't load suggestions right now. Please try again." };
  }
}
