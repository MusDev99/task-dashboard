import type { ReactNode } from "react";
import { LOCATION_TYPES, type EntityKind, type SettingRecord } from "../../lib/settings-validation";

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "time" | "number" | "color" | "select" | "checkbox" | "textarea";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** Keys/codes can't change once created. */
  immutable?: boolean;
  /** Shown in a two-column row with the next field. */
  half?: boolean;
}

export interface ColumnDef {
  label: string;
  className?: string;
  render: (r: SettingRecord) => ReactNode;
}

export interface EntityDef {
  kind: EntityKind;
  title: string;
  description: string;
  addLabel: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  defaults: SettingRecord;
  /** Name shown in toasts/dialogs. */
  name: (r: SettingRecord) => string;
}

/** Colour presets offered next to the native picker (any #rrggbb is allowed). */
export const COLOR_PRESETS = ["#6c63ff", "#9b5de5", "#f15bb5", "#ff6b6b", "#ff9f1c", "#ffc233", "#00c9a7", "#3b9eff", "#8b8da3"];

const Chip = ({ text, color }: { text: string; color: string }) => (
  <span className="code-chip settings-chip" style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)`, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>{text}</span>
);
const Dot = ({ color }: { color: string }) => <span className="status-pill-dot" style={{ background: color, width: 10, height: 10 }} />;
const yes = (v: unknown) => (v ? "Yes" : "No");

const sortField: FieldDef = { key: "sortOrder", label: "Display order", type: "number", hint: "Lower numbers appear first.", half: true };
const activeField: FieldDef = { key: "active", label: "Active", type: "checkbox", hint: "Inactive items stay where they're already used but can't be picked." };
const colorField: FieldDef = { key: "color", label: "Colour", type: "color", required: true };

export const ENTITIES: Record<EntityKind, EntityDef> = {
  shift: {
    kind: "shift",
    title: "Work shifts",
    description: "Shift codes people can be rostered on. Hours drive capacity and the roster's monthly totals.",
    addLabel: "Add shift",
    name: (r) => `${r.code} · ${r.label}`,
    defaults: { code: "", label: "", start: "09:00", end: "18:00", hours: "", color: "#ffc233", active: true, sortOrder: 100 },
    fields: [
      { key: "code", label: "Code", type: "text", required: true, immutable: true, placeholder: "NS", hint: "1–6 letters/digits, shown in roster cells. Can't be changed later.", half: true },
      { key: "label", label: "Name", type: "text", required: true, placeholder: "Night shift", half: true },
      { key: "start", label: "Start", type: "time", required: true, half: true },
      { key: "end", label: "End", type: "time", required: true, half: true, hint: "Earlier than start = overnight." },
      { key: "hours", label: "Paid hours", type: "number", hint: "Calculated from start–end; adjust for unpaid breaks.", half: true },
      sortField,
      colorField,
      activeField,
    ],
    columns: [
      { label: "Code", render: (r) => <Chip text={String(r.code)} color={String(r.color)} /> },
      { label: "Name", render: (r) => <b>{String(r.label)}</b> },
      { label: "Time", render: (r) => <span className="mono">{String(r.start)} – {String(r.end)}</span> },
      { label: "Hours", className: "num", render: (r) => String(r.hours) },
    ],
  },
  leave: {
    kind: "leave",
    title: "Leave types",
    description: "Absence codes such as public holiday, annual or medical leave. They count as leave days, not working hours.",
    addLabel: "Add leave type",
    name: (r) => `${r.code} · ${r.label}`,
    defaults: { code: "", label: "", color: "#00c9a7", paid: true, active: true, sortOrder: 100 },
    fields: [
      { key: "code", label: "Code", type: "text", required: true, immutable: true, placeholder: "EL", hint: "1–6 letters/digits. Can't be changed later.", half: true },
      { key: "label", label: "Name", type: "text", required: true, placeholder: "Emergency leave", half: true },
      { key: "paid", label: "Paid leave", type: "checkbox", hint: "For reporting; doesn't change roster hours." },
      sortField,
      colorField,
      activeField,
    ],
    columns: [
      { label: "Code", render: (r) => <Chip text={String(r.code)} color={String(r.color)} /> },
      { label: "Name", render: (r) => <b>{String(r.label)}</b> },
      { label: "Paid", render: (r) => yes(r.paid) },
    ],
  },
  location: {
    kind: "location",
    title: "Locations",
    description: "Where people work — offices, stations, sites or remote. Each person belongs to one location.",
    addLabel: "Add location",
    name: (r) => String(r.name),
    defaults: { code: "", name: "", type: "office", address: "", active: true },
    fields: [
      { key: "code", label: "Code", type: "text", required: true, placeholder: "KUL-HQ", hint: "Short code, 1–10 letters/digits/dashes.", half: true },
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Kuala Lumpur HQ", half: true },
      { key: "type", label: "Type", type: "select", options: LOCATION_TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) })) },
      { key: "address", label: "Address", type: "textarea", placeholder: "Optional" },
      activeField,
    ],
    columns: [
      { label: "Code", render: (r) => <span className="code-tag">{String(r.code)}</span> },
      { label: "Name", render: (r) => <b>{String(r.name)}</b> },
      { label: "Type", render: (r) => <span className="badge badge-neutral">{String(r.type)}</span> },
      { label: "Address", render: (r) => <span className="muted">{String(r.address) || "—"}</span> },
    ],
  },
  role: {
    kind: "role",
    title: "Roles",
    description: "Job roles you can give people (e.g. Engineer, Supervisor). Used for display and filtering.",
    addLabel: "Add role",
    name: (r) => String(r.name),
    defaults: { name: "", description: "", active: true },
    fields: [
      { key: "name", label: "Name", type: "text", required: true, placeholder: "Software Engineer" },
      { key: "description", label: "Description", type: "textarea", placeholder: "Optional" },
      activeField,
    ],
    columns: [
      { label: "Name", render: (r) => <b>{String(r.name)}</b> },
      { label: "Description", render: (r) => <span className="muted">{String(r.description) || "—"}</span> },
    ],
  },
  status: {
    kind: "status",
    title: "Task statuses",
    description: "Workflow columns on the Kanban board. Open statuses count toward a person's workload.",
    addLabel: "Add status",
    name: (r) => String(r.label),
    defaults: { key: "", label: "", color: "#3b9eff", open: true, isDefault: false, isDone: false, active: true, sortOrder: 100 },
    fields: [
      { key: "label", label: "Name", type: "text", required: true, placeholder: "In Review", half: true },
      { key: "key", label: "Key", type: "text", required: true, immutable: true, placeholder: "in_review", hint: "Stored on tasks. Can't be changed later.", half: true },
      { key: "open", label: "Counts as open work", type: "checkbox", hint: "Open tasks count toward the assignee's open story points." },
      { key: "isDefault", label: "Default for new tasks", type: "checkbox", hint: "Exactly one. Choosing this switches the previous default off." },
      { key: "isDone", label: "Done status", type: "checkbox", hint: "Exactly one. Used when ticking a subtask as done." },
      sortField,
      colorField,
      activeField,
    ],
    columns: [
      { label: "Status", render: (r) => <span className="settings-status"><Dot color={String(r.color)} /><b>{String(r.label)}</b></span> },
      { label: "Key", render: (r) => <span className="code-tag">{String(r.key)}</span> },
      { label: "Open", render: (r) => yes(r.open) },
      { label: "Role", render: (r) => (r.isDefault ? <span className="badge badge-indigo">Default</span> : r.isDone ? <span className="badge badge-emerald">Done</span> : <span className="muted">—</span>) },
    ],
  },
  point: {
    kind: "point",
    title: "Story points",
    description: "The estimation scale for tasks, with a complexity level for each value.",
    addLabel: "Add value",
    name: (r) => `${r.value} SP`,
    defaults: { value: "", complexity: "", label: "", active: true },
    fields: [
      { key: "value", label: "Points", type: "number", required: true, immutable: true, placeholder: "21", hint: "Whole number. Can't be changed later.", half: true },
      { key: "complexity", label: "Complexity", type: "text", required: true, placeholder: "XXXL", half: true },
      { key: "label", label: "Description", type: "text", placeholder: "Epic — split it" },
      activeField,
    ],
    columns: [
      { label: "Points", className: "num", render: (r) => <b className="mono">{String(r.value)}</b> },
      { label: "Complexity", render: (r) => <span className="badge badge-indigo">{String(r.complexity)}</span> },
      { label: "Description", render: (r) => <span className="muted">{String(r.label) || "—"}</span> },
    ],
  },
};

export const SECTION_ORDER: (EntityKind | "general")[] = ["general", "shift", "leave", "location", "role", "status", "point"];
export const SECTION_LABEL: Record<EntityKind | "general", string> = {
  general: "General", shift: "Work shifts", leave: "Leave types", location: "Locations", role: "Roles", status: "Task statuses", point: "Story points",
};
