// Leave requests (pure, no data access): shapes, validation and who may decide.
// No runtime imports on purpose: tests run this file directly with `node --test`.

export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled", "revoked"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];
export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled", revoked: "Revoked" };

export interface LeaveRequest {
  id: string;
  userId: string;
  startDate: string; // YYYY-MM-DD, inclusive
  endDate: string; // YYYY-MM-DD, inclusive
  code: string; // a leave code from the roster codes
  note: string;
  status: LeaveStatus;
  decidedBy: string;
  decidedAt: string;
  decisionNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveInput {
  startDate: string;
  endDate: string;
  code: string;
  note: string;
}

export type LeaveErrors = Partial<Record<keyof LeaveInput, string>>;

export const MAX_LEAVE_DAYS = 62;
export const MAX_LEAD_DAYS = 366; // how far ahead a request may start
export const NOTE_MAX = 200;

export const isLeaveStatus = (v: unknown): v is LeaveStatus => (LEAVE_STATUSES as readonly string[]).includes(String(v));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const parts = (d: string) => d.split("-").map(Number) as [number, number, number];
export function isRealDate(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const [y, m, day] = parts(d);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
}
const dayNo = (d: string) => {
  const [y, m, day] = parts(d);
  return Math.round(Date.UTC(y, m - 1, day) / 86_400_000);
};
const fromDayNo = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/** Every date from start to end, inclusive. Empty when either is not a real date or end is before start. */
export function datesBetween(start: string, end: string): string[] {
  if (!isRealDate(start) || !isRealDate(end) || dayNo(end) < dayNo(start)) return [];
  const out: string[] = [];
  for (let n = dayNo(start); n <= dayNo(end); n++) out.push(fromDayNo(n));
  return out;
}

export const dayCount = (start: string, end: string) => datesBetween(start, end).length;

/** Trim and normalise form input (be liberal in what is accepted). */
export function cleanLeaveInput(raw: Partial<Record<keyof LeaveInput, unknown>>): LeaveInput {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
  const startDate = s(raw.startDate);
  const endDate = s(raw.endDate) || startDate; // a single day needs only a start
  return { startDate, endDate, code: s(raw.code).toUpperCase(), note: s(raw.note).replace(/\s+/g, " ") };
}

export interface LeaveContext {
  /** Today in the organisation's time zone (YYYY-MM-DD). */
  today: string;
  leaveCodes: readonly { code: string; active: boolean }[];
  /** The requester's other requests (to refuse overlaps). */
  existing: readonly { id: string; startDate: string; endDate: string; status: string }[];
  /** The request being edited, if any (excluded from the overlap check). */
  ignoreId?: string;
}

export function validateLeaveInput(input: LeaveInput, ctx: LeaveContext): LeaveErrors {
  const e: LeaveErrors = {};
  const code = ctx.leaveCodes.find((c) => c.code === input.code);
  if (!code) e.code = "Choose a leave type";
  else if (!code.active) e.code = "This leave type isn't available";

  if (!isRealDate(input.startDate)) e.startDate = "Pick a start date";
  else if (input.startDate < ctx.today) e.startDate = "Start date can't be in the past";
  else if (dayNo(input.startDate) - dayNo(ctx.today) > MAX_LEAD_DAYS) e.startDate = "Start date is too far ahead";

  if (!isRealDate(input.endDate)) e.endDate = "Pick an end date";
  else if (!e.startDate && input.endDate < input.startDate) e.endDate = "End date can't be before the start date";
  else if (!e.startDate && dayCount(input.startDate, input.endDate) > MAX_LEAVE_DAYS) e.endDate = `A request can cover at most ${MAX_LEAVE_DAYS} days`;

  if (input.note.length > NOTE_MAX) e.note = `Note must be ${NOTE_MAX} characters or fewer`;

  if (!e.startDate && !e.endDate) {
    const clash = ctx.existing.find((x) => x.id !== ctx.ignoreId && (x.status === "pending" || x.status === "approved") && x.startDate <= input.endDate && x.endDate >= input.startDate);
    if (clash) e.startDate = "You already have a pending or approved request for some of these dates";
  }
  return e;
}

/**
 * Whether the actor may approve or reject a request by `requesterId`.
 * Admins and planners decide any request. A lead decides only for people in the teams they lead, never their own.
 * `scope` = the people in teams the actor leads (null when not a lead).
 */
export function canDecideLeave(level: string, actorUid: string, requesterId: string, scope: ReadonlySet<string> | null): boolean {
  if (level === "admin" || level === "planner") return true;
  if (level === "lead") return !!actorUid && requesterId !== actorUid && !!scope?.has(requesterId);
  return false;
}

/** A pending request can be approved, rejected or cancelled; an approved one can only be revoked. Everything else is final. */
export const canTransition = (from: LeaveStatus, to: LeaveStatus) =>
  (from === "pending" && (to === "approved" || to === "rejected" || to === "cancelled")) || (from === "approved" && to === "revoked");

/** The requester may take back their own approved leave; anyone who could decide it may revoke it. */
export function canRevokeLeave(level: string, actorUid: string, requesterId: string, scope: ReadonlySet<string> | null): boolean {
  return (!!actorUid && actorUid === requesterId) || canDecideLeave(level, actorUid, requesterId, scope);
}

/** The calendar day before `date` (YYYY-MM-DD). */
export const dayBefore = (date: string) => fromDayNo(dayNo(date) - 1);

export interface RevokePlan {
  /** nothing = the leave is already over; revoked = it hadn't started; shortened = under way, so it now ends yesterday. */
  kind: "nothing" | "revoked" | "shortened";
  /** Roster days to clear: from today on, and still holding this leave code. */
  clear: string[];
  /** Remaining days that no longer hold the leave code (changed by a planner, or already cleared): left alone. */
  untouched: number;
  /** Remaining days of the request (today onwards). */
  futureDays: number;
  newEndDate: string | null;
}

/**
 * What revoking would do. Days before today stay as history. Only days whose roster cell still holds the leave
 * code are cleared, so a day a planner has since changed to something else is never wiped.
 */
export function planRevoke(r: { startDate: string; endDate: string; code: string }, today: string, roster: readonly { date: string; code: string }[]): RevokePlan {
  const none: RevokePlan = { kind: "nothing", clear: [], untouched: 0, futureDays: 0, newEndDate: null };
  if (!isRealDate(r.startDate) || !isRealDate(r.endDate) || !isRealDate(today) || r.endDate < today) return none;
  const future = datesBetween(r.startDate > today ? r.startDate : today, r.endDate);
  const has = new Map(roster.map((x) => [x.date, x.code]));
  const clear = future.filter((d) => has.get(d) === r.code);
  const started = r.startDate < today;
  return { kind: started ? "shortened" : "revoked", clear, untouched: future.length - clear.length, futureDays: future.length, newEndDate: started ? dayBefore(today) : null };
}

/** Requests this person may see: their own, plus (admins/planners) everyone's, plus (leads) their teams'. */
export function visibleLeave<T extends { userId: string }>(requests: readonly T[], level: string, uid: string, scope: ReadonlySet<string> | null): T[] {
  if (level === "admin" || level === "planner") return [...requests];
  return requests.filter((r) => r.userId === uid || (level === "lead" && !!scope?.has(r.userId)));
}
