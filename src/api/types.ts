import type { Shift } from "../types.js";

/** Abstract shift scheduling API client. */
export interface ShiftApiClient {
  /** Get shifts for an instructor within a date range. */
  getShiftsForInstructor(instructorId: string, from: string, to: string): Promise<Shift[]>;

  /** Get a single shift by ID. */
  getShiftById(shiftId: string): Promise<Shift | null>;

  /** Get all shifts at a site on a specific date. */
  getShiftsForSite(siteId: string, date: string): Promise<Shift[]>;

  /** Get a specific instructor's shift on a date. */
  getInstructorShiftOnDate(instructorId: string, date: string): Promise<Shift | null>;
}
