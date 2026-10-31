import type { User } from "../app/lib/types";
import { isAccessLevel } from "./access";

export interface UserInput {
  name: string;
  email: string;
  employeeId: string;
  locationId: string;
  phoneNumber: string;
  roleId: string;
  avatar: string;
  isActive: boolean;
  /** Access level; empty = keep the current one (edit) or Member (new). */
  access: string;
}

export type FieldErrors = Partial<Record<keyof UserInput, string>>;

/** Trims every text field (be liberal in what we accept). */
export function cleanUserInput(raw: Partial<UserInput>): UserInput {
  const t = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    name: t(raw.name),
    email: t(raw.email).toLowerCase(),
    employeeId: t(raw.employeeId),
    locationId: t(raw.locationId),
    phoneNumber: t(raw.phoneNumber),
    roleId: t(raw.roleId),
    avatar: t(raw.avatar),
    isActive: raw.isActive !== false,
    access: t(raw.access).toLowerCase(),
  };
}

export interface UserRefs {
  activeLocationIds: Set<string>;
  activeRoleIds: Set<string>;
}

/** Validates cleaned input. `existing` is the full user list, `selfId` the user being edited. */

export function validateUserInput(input: UserInput, existing: User[], refs: UserRefs, selfId?: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!input.name) errors.name = "Name is required";
  else if (input.name.length > 80) errors.name = "Name must be 80 characters or fewer";

  if (!input.email) errors.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.email = "Enter a valid email address";
  else if (existing.some((u) => u.id !== selfId && u.email.toLowerCase() === input.email)) {
    errors.email = "A user with this email already exists";
  }

  // Locations / roles must exist and be active; the user's current value stays allowed after deactivation.
  const current = existing.find((u) => u.id === selfId);
  if (input.locationId && current?.locationId !== input.locationId && !refs.activeLocationIds.has(input.locationId)) {
    errors.locationId = "Pick an active location";
  }
  if (input.roleId && current?.roleId !== input.roleId && !refs.activeRoleIds.has(input.roleId)) {
    errors.roleId = "Pick an active role";
  }
  if (input.employeeId && !/^[\w-]{1,20}$/.test(input.employeeId)) {
    errors.employeeId = "Letters, digits, - and _ only (max 20)";
  }
  if (input.phoneNumber && !/^\+?[\d\s()-]{6,20}$/.test(input.phoneNumber)) {
    errors.phoneNumber = "Enter a valid phone number";
  }
  if (input.access && !isAccessLevel(input.access)) errors.access = "Pick an access level";
  if (input.avatar && !/^https:\/\/\S+$/i.test(input.avatar)) {
    errors.avatar = "Avatar must be an https:// URL";
  }
  return errors;
}
