/** A swim instructor registered with the system. */
export type Instructor = {
  name: string;
  /** E.164 format, e.g. "+61400000000" */
  phone: string;
  /** Email is the unique identifier. */
  email: string;
  siteIds: string[];
};

/** A site manager. */
export type Manager = {
  name: string;
  /** E.164 format, e.g. "+61400000000" */
  phone: string;
  /** Email is the unique identifier. */
  email: string;
  siteIds: string[];
};

/** A swim school site. */
export type Site = {
  siteId: string;
};

/** A single instructor shift returned by the scheduling API. */
export type Shift = {
  shiftId: string;
  instructorEmail: string;
  siteId: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm */
  endTime: string;
};

export type CoverRequestStatus =
  | "pending"
  | "accepted"
  | "manager_notified"
  | "approved"
  | "rejected"
  | "expired";

/** Tracks a shift-cover request through its lifecycle. */
export type CoverRequest = {
  id: string;
  requesterId: string;
  shiftId: string;
  siteId: string;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  status: CoverRequestStatus;
  /** Instructor ID of the person who accepted. */
  coveredById?: string;
  createdAt: number;
  updatedAt: number;
  /** E.164 phones of instructors who were asked. */
  notifiedInstructors: string[];
  /** E.164 phones of instructors who declined. */
  declinedInstructors: string[];
  managerNotifiedAt?: number;
  reason?: string;
};

/** A Google Doc whitelisted for instructor access. */
export type AllowedDoc = {
  docId: string;
  title: string;
  category?: string;
};

/** Plugin configuration shape (matches openclaw.plugin.json configSchema). */
export type SwimSchoolPluginConfig = {
  instructors?: Instructor[];
  managers?: Manager[];
  sites?: Site[];
  /** Drive folder name to list documents from (default: "instructors"). */
  driveFolder?: string;
  apiMode?: "mock" | "live";
  apiBaseUrl?: string;
  coverRequestExpiryHours?: number;
};
