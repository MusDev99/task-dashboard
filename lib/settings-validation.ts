// Pure definitions + validation for Operational Settings (safe on server and client).
import {
  LOCATION_COLUMNS, ROLE_COLUMNS, ROSTER_CODE_COLUMNS, STORY_POINT_COLUMNS, TASK_STATUS_COLUMNS,
} from "./schema";

export const LOCATION_TYPES = ["office", "station", "site", "remote", "other"] as const;

export type EntityKind = "shift" | "leave" | "location" | "role" | "status" | "point";
export type SettingValue = string | number | boolean;
export type SettingRecord = Record<string, SettingValue>;
export type SettingErrors = Record<string, string>;

export interface EntitySpec {
  tab: string;
  headers: readonly string[];
  /** Column that identifies a row; immutable after creation. */
  keyField: string;
  noun: string;
}

export const SPECS: Record<EntityKind, EntitySpec> = {
  shift: { tab: "roster_codes", headers: ROSTER_CODE_COLUMNS, keyField: "code", noun: "work shift" },
  leave: { tab: "roster_codes", headers: ROSTER_CODE_COLUMNS, keyField: "code", noun: "leave type" },
  location: { tab: "locations", headers: LOCATION_COLUMNS, keyField: "id", noun: "location" },
  role: { tab: "roles", headers: ROLE_COLUMNS, keyField: "id", noun: "role" },
  status: { tab: "task_statuses", headers: TASK_STATUS_COLUMNS, keyField: "key", noun: "task status" },
  point: { tab: "story_points", headers: STORY_POINT_COLUMNS, keyField: "value", noun: "story point" },
};

export const keyOf = (kind: EntityKind, r: SettingRecord) => String(r[SPECS[kind].keyField] ?? "");

const s = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const b = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : v == null || v === "" ? fallback : ["true", "1", "yes", "on"].includes(String(v).toLowerCase()));
const n = (v: unknown) => (v === "" || v == null ? NaN : Number(v));

/** Minutes between HH:mm times; an end before the start means the shift runs overnight. */
export function shiftHours(start: string, end: string): number | null {
  const m = (t: string) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
  const a = m(start), z = m(end);
  if (a == null || z == null) return null;
  const mins = (z - a + 24 * 60) % (24 * 60) || 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

/** Normalise form input into the stored row (be liberal in what we accept). */
export function cleanEntity(kind: EntityKind, raw: Record<string, unknown>): SettingRecord {
  switch (kind) {
    case "shift": {
      const start = s(raw.start), end = s(raw.end);
      const hours = s(raw.hours) === "" ? shiftHours(start, end) ?? NaN : n(raw.hours);
      return { code: s(raw.code).toUpperCase(), type: "shift", label: s(raw.label), start, end, hours, color: s(raw.color).toLowerCase(), paid: true, active: b(raw.active, true), sortOrder: n(raw.sortOrder) || 100 };
    }
    case "leave":
      return { code: s(raw.code).toUpperCase(), type: "leave", label: s(raw.label), start: "", end: "", hours: 0, color: s(raw.color).toLowerCase(), paid: b(raw.paid, true), active: b(raw.active, true), sortOrder: n(raw.sortOrder) || 100 };
    case "location":
      return { id: s(raw.id), code: s(raw.code).toUpperCase(), name: s(raw.name), type: s(raw.type) || "office", address: s(raw.address), active: b(raw.active, true) };
    case "role":
      return { id: s(raw.id), name: s(raw.name), description: s(raw.description), active: b(raw.active, true) };
    case "status":
      return { key: s(raw.key).toLowerCase().replace(/\s+/g, "_"), label: s(raw.label), color: s(raw.color).toLowerCase(), open: b(raw.open, true), isDefault: b(raw.isDefault, false), isDone: b(raw.isDone, false), active: b(raw.active, true), sortOrder: n(raw.sortOrder) || 100 };
    case "point":
      return { value: n(raw.value), complexity: s(raw.complexity).toUpperCase(), label: s(raw.label), active: b(raw.active, true) };
  }
}

const HEX = /^#[0-9a-f]{6}$/;

/**
 * Validate one record against the others of its tab. `originalKey` is the key being edited (null = new).
 * For roster codes, `existing` holds shift AND leave codes (codes are unique across both).
 */
export function validateEntity(kind: EntityKind, r: SettingRecord, existing: SettingRecord[], originalKey: string | null): SettingErrors {
  const e: SettingErrors = {};
  const others = existing.filter((x) => keyOf(kind, x) !== originalKey);
  const req = (field: string, label: string, max = 60) => {
    const v = String(r[field] ?? "");
    if (!v) e[field] = `${label} is required`;
    else if (v.length > max) e[field] = `${label} must be ${max} characters or fewer`;
  };

  if (kind === "shift" || kind === "leave") {
    const code = String(r.code);
    if (!/^[A-Z0-9]{1,6}$/.test(code)) e.code = "Use 1–6 letters or digits, e.g. NS or AL";
    else if (others.some((x) => x.code === code)) e.code = `Code ${code} is already used by another shift or leave type`;
    req("label", "Name");
    if (!HEX.test(String(r.color))) e.color = "Pick a colour";
    if (kind === "shift") {
      if (shiftHours(String(r.start), "00:00") == null) e.start = "Use HH:mm, e.g. 09:00";
      if (shiftHours("00:00", String(r.end)) == null) e.end = "Use HH:mm, e.g. 18:00";
      const h = Number(r.hours);
      if (!Number.isFinite(h) || h < 0 || h > 24) e.hours = "Hours must be between 0 and 24";
    }
  }

  if (kind === "location") {
    req("name", "Name");
    const code = String(r.code);
    if (!/^[A-Z0-9-]{1,10}$/.test(code)) e.code = "Use 1–10 letters, digits or dashes, e.g. KUL-HQ";
    else if (others.some((x) => x.code === code)) e.code = `Code ${code} is already used`;
    if (others.some((x) => String(x.name).toLowerCase() === String(r.name).toLowerCase())) e.name = "A location with this name already exists";
    if (String(r.address).length > 200) e.address = "Address must be 200 characters or fewer";
  }

  if (kind === "role") {
    req("name", "Name");
    if (others.some((x) => String(x.name).toLowerCase() === String(r.name).toLowerCase())) e.name = "A role with this name already exists";
    if (String(r.description).length > 200) e.description = "Description must be 200 characters or fewer";
  }

  if (kind === "status") {
    const key = String(r.key);
    if (!/^[a-z][a-z_]{1,19}$/.test(key)) e.key = "Use 2–20 lowercase letters or _, e.g. in_review";
    else if (others.some((x) => x.key === key)) e.key = "This key already exists";
    req("label", "Name", 30);
    if (!HEX.test(String(r.color))) e.color = "Pick a colour";
    if (r.isDefault && (!r.active || !r.open)) e.isDefault = "The default status must be active and count as open";
    if (r.isDone && (!r.active || r.open)) e.isDone = "The done status must be active and must not count as open";
    // There must always be exactly one default and one done status (others are switched off automatically).
    const wasDefault = existing.find((x) => keyOf(kind, x) === originalKey)?.isDefault === true;
    const wasDone = existing.find((x) => keyOf(kind, x) === originalKey)?.isDone === true;
    if (wasDefault && !r.isDefault) e.isDefault = "Make another status the default first";
    if (wasDone && !r.isDone) e.isDone = "Make another status the done status first";
    if (![...others, r].some((x) => x.active && x.open)) e.open = "At least one active status must count as open";
  }

  if (kind === "point") {
    const v = Number(r.value);
    if (!Number.isInteger(v) || v < 1 || v > 100) e.value = "Use a whole number from 1 to 100";
    else if (others.some((x) => Number(x.value) === v)) e.value = "This value already exists";
    req("complexity", "Complexity", 4);
    if (String(r.label).length > 40) e.label = "Label must be 40 characters or fewer";
  }
  return e;
}

// ─── General settings ───
export interface GeneralInput {
  timezone: string;
  codePrefix: string;
  weekStart: number;
  maxLabels: number;
  maxLinks: number;
}

export function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.length > 0;
  } catch {
    return false;
  }
}

export function validateGeneral(g: GeneralInput): SettingErrors {
  const e: SettingErrors = {};
  if (!validTimezone(g.timezone)) e.timezone = "Use an IANA time zone, e.g. Asia/Kuala_Lumpur";
  if (!/^[A-Z]{2,5}$/.test(g.codePrefix)) e.codePrefix = "Use 2–5 capital letters, e.g. TSK";
  if (g.weekStart !== 0 && g.weekStart !== 1) e.weekStart = "Choose Sunday or Monday";
  if (!Number.isInteger(g.maxLabels) || g.maxLabels < 1 || g.maxLabels > 50) e.maxLabels = "Use 1–50";
  if (!Number.isInteger(g.maxLinks) || g.maxLinks < 1 || g.maxLinks > 50) e.maxLinks = "Use 1–50";
  return e;
}
