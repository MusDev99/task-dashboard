import type { AccessLevel } from "../../lib/access";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  joinedDate: string;
  employeeId: string | null;
  googleId: string | null;
  isActive: boolean;
  updatedAt: string;
  phoneNumber: string | null;
  roleId: string | null;
  locationId: string | null;
  access: AccessLevel;
}
