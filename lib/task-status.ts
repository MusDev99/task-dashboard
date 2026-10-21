// Pure helpers (safe in client components; lib/task-config.ts reads the sheet).
import type { TaskConfig } from "./task-config";

/** The status new tasks start in. */
export const defaultStatus = (c: TaskConfig) => (c.statuses.find((s) => s.isDefault) ?? c.statuses[0]).key;
/** The status used when a subtask is ticked as done. */
export const doneStatus = (c: TaskConfig) => (c.statuses.find((s) => s.isDone) ?? c.statuses[c.statuses.length - 1]).key;
