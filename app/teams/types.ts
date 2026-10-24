export interface Team {
  id: string;
  name: string;
  description: string;
  leadId: string | null;
  color: string; // #rrggbb
  createdAt: string;
  updatedAt: string;
}

/** One row per (team, user). id = `${teamId}_${userId}`. */
export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  addedAt: string;
}

/** What the drawer sends to the server (the server fills id/timestamps). */
export interface TeamInput {
  name: string;
  description: string;
  color: string;
  leadId: string;
  memberIds: string[];
}

export interface TeamRow extends Team {
  memberIds: string[];
}

/** Compact team for filters on other pages (Roster, Tasks). */
export interface TeamOption {
  id: string;
  name: string;
  color: string;
  memberIds: string[];
}

export interface TeamPerson {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
  avatar: string | null;
  isActive: boolean;
  locationName: string | null;
}
