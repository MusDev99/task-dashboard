export interface RosterEntry {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  type: "shift" | "leave";
  code: string;
  updatedAt: string;
}

export interface Resource {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  locationId: string | null;
  locationName: string | null;
  avatar: string | null;
}

export interface CellRef {
  userId: string;
  date: string;
}
