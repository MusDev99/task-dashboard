// Tasks → CSV rows (pure; the shared writer in app/roster/csv.ts quotes and neutralises formulas).
import type { WorkTask } from "./types";

export const TASK_EXPORT_HEADER = ["code", "parent", "title", "status", "assignee", "email", "storyPoints", "startDate", "dueDate", "labels", "links"];

export interface ExportPerson {
  name: string;
  email: string;
}

/** Status keys become their configured labels; unknown keys fall back to the raw key. */
export function tasksToRows(
  tasks: readonly WorkTask[],
  people: ReadonlyMap<string, ExportPerson>,
  statusLabel: (key: string) => string,
  displayName: (name: string) => string = (n) => n,
): string[][] {
  const codeById = new Map(tasks.map((t) => [t.id, t.code]));
  const rows = tasks.map((t) => {
    const who = t.assigneeId ? people.get(t.assigneeId) : undefined;
    return [
      t.code,
      t.parentId ? codeById.get(t.parentId) ?? "" : "",
      t.title,
      statusLabel(t.status),
      who ? displayName(who.name) : "",
      who?.email ?? "",
      t.storyPoints == null ? "" : String(t.storyPoints),
      t.startDate ?? "",
      t.dueDate ?? "",
      t.labels.join("; "),
      t.links.map((l) => l.url).join("; "),
    ];
  });
  return [TASK_EXPORT_HEADER, ...rows];
}
