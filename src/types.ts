/** A swim instructor registered with the system. */
export type Instructor = {
  instructorId: string;
  name: string;
  /** E.164 format, e.g. "+61400000000" */
  phone: string;
  email: string;
  siteId: string;
};

/** A swim school site (typically a suburb). */
export type Site = {
  siteId: string;
  name: string;
  suburb: string;
  /** E.164 phone of the site manager. */
  managerPhone: string;
  managerName: string;
};

/** A single instructor shift returned by the scheduling API. */
export type Shift = {
  shiftId: string;
  instructorId: string;
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
  sites?: Site[];
  allowedDocs?: AllowedDoc[];
  apiMode?: "mock" | "live";
  apiBaseUrl?: string;
  coverRequestExpiryHours?: number;
  gwBinaryPath?: string;
};
