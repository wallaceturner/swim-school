import type { Shift } from "../types.js";
import type { ShiftApiClient } from "./types.js";

export class MockShiftApiClient implements ShiftApiClient {
  private shifts: Shift[];

  constructor(instructorEmails: string[], siteIds: string[]) {
    this.shifts = generateMockShifts(instructorEmails, siteIds);
  }

  async getShiftsForInstructor(email: string, from: string, to: string): Promise<Shift[]> {
    return this.shifts.filter(
      (s) => s.instructorEmail === email && s.date >= from && s.date <= to,
    );
  }

  async getShiftById(shiftId: string): Promise<Shift | null> {
    return this.shifts.find((s) => s.shiftId === shiftId) ?? null;
  }

  async getShiftsForSite(siteId: string, date: string): Promise<Shift[]> {
    return this.shifts.filter((s) => s.siteId === siteId && s.date === date);
  }

  async getInstructorShiftOnDate(email: string, date: string): Promise<Shift | null> {
    return this.shifts.find((s) => s.instructorEmail === email && s.date === date) ?? null;
  }
}

/** Generate 2 weeks of mock shifts, stable per week (anchored to Monday). */
function generateMockShifts(emails: string[], siteIds: string[]): Shift[] {
  const shifts: Shift[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Anchor to this week's Monday for stability
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(monday.getDate() + mondayOffset);

  const timeSlots = [
    { start: "06:00", end: "10:00" },
    { start: "10:00", end: "14:00" },
    { start: "14:00", end: "18:00" },
  ];

  let counter = 0;
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(monday);
    date.setDate(date.getDate() + dayOffset);
    if (date.getDay() === 0) continue; // Skip Sundays

    const dateStr = date.toISOString().slice(0, 10);

    for (const email of emails) {
      // Each instructor works ~4 days per week
      if ((dayOffset + email.charCodeAt(0)) % 7 < 3) continue;

      const slot = timeSlots[counter % timeSlots.length];
      const siteId = siteIds[counter % siteIds.length] ?? "site-default";
      shifts.push({
        shiftId: `mock-shift-${++counter}`,
        instructorEmail: email,
        siteId,
        date: dateStr,
        startTime: slot.start,
        endTime: slot.end,
      });
    }
  }

  return shifts;
}
