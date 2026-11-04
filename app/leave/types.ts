import type { LeaveRequest } from "../../lib/leave";

/** A request as the page shows it: names resolved and what this viewer may do already decided on the server. */
export interface LeaveRow extends LeaveRequest {
  userName: string;
  decidedByName: string;
  mine: boolean;
  /** Pending and this viewer may approve / reject it. */
  decidable: boolean;
}

export interface LeaveTypeOption {
  code: string;
  label: string;
  color: string;
  active: boolean;
}
