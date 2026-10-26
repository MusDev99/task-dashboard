import type { User } from "../lib/types";

export interface UserRow extends User {
  locationName: string | null;
  roleName: string | null;
}

export interface Option {
  id: string;
  name: string;
  active: boolean;
}

/** Choices for the user form (from Settings). */
export interface UserOptions {
  locations: Option[];
  roles: Option[];
}
