// Column order of each table (row 1 = header).
export const USER_COLUMNS = [
  "id", "email", "name", "employeeId", "googleId", "isActive", "joinedDate",
  "updatedAt", "phoneNumber", "roleId", "avatar", "locationId", "access",
] as const;
// `access` (admin | planner | lead | member) is optional when reading: a users tab without the column
// predates access levels, so everyone keeps full access until `npm run migrate:settings` adds it.
export const USER_REQUIRED_COLUMNS = USER_COLUMNS.filter((c) => c !== "access");

// One row per user per day. id = `${userId}_${date}` (date = YYYY-MM-DD), so upserts can't duplicate.
export const ROSTER_COLUMNS = ["id", "userId", "date", "type", "code", "updatedAt"] as const;

// Work tasks and their subtasks (parentId set = subtask, one level only).
// labels / links are JSON-encoded arrays; dates are YYYY-MM-DD and optional.
export const WORK_TASK_COLUMNS = [
  "id", "code", "parentId", "title", "description", "status", "storyPoints", "assigneeId",
  "labels", "links", "startDate", "dueDate", "createdAt", "updatedAt",
] as const;

// ─── Operational settings (managed on /settings; json/ files are only seed defaults) ───
export const ROSTER_CODE_COLUMNS = ["code", "type", "label", "start", "end", "hours", "color", "paid", "active", "sortOrder"] as const;
export const LOCATION_COLUMNS = ["id", "code", "name", "type", "address", "active"] as const;
export const ROLE_COLUMNS = ["id", "name", "description", "active"] as const;
export const TASK_STATUS_COLUMNS = ["key", "label", "color", "open", "isDefault", "isDone", "active", "sortOrder"] as const;
export const STORY_POINT_COLUMNS = ["value", "complexity", "label", "active"] as const;
// Minimum head-count per shift code (optionally per location and day type); drives the Roster coverage panel.
export const COVERAGE_COLUMNS = ["id", "locationId", "code", "days", "minStaff", "active"] as const;
export const APP_SETTING_COLUMNS = ["key", "value"] as const;

// Teams (many-to-many with users through team_members). Membership id = `${teamId}_${userId}`, so upserts can't duplicate.
export const TEAM_COLUMNS = ["id", "name", "description", "leadId", "color", "createdAt", "updatedAt"] as const;
export const TEAM_MEMBER_COLUMNS = ["id", "teamId", "userId", "addedAt"] as const;

// Leave requests (one row per request; approving one writes the leave code into the roster for each day).
export const LEAVE_COLUMNS = ["id", "userId", "startDate", "endDate", "code", "note", "status", "decidedBy", "decidedAt", "decisionNote", "createdAt", "updatedAt"] as const;

// In-app notifications, one row per recipient (a person only ever reads or marks their own).
export const NOTIFICATION_COLUMNS = ["id", "userId", "kind", "title", "body", "href", "createdAt", "readAt"] as const;

// Append-only change history (admins read it on /audit). Never edited or deleted by the app.
export const AUDIT_COLUMNS = ["id", "at", "actorId", "actorLevel", "action", "entity", "entityId", "summary"] as const;
