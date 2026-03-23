import type { Shift } from "../types.js";
import type { ShiftApiClient } from "./types.js";

/**
 * Mock shift API client that returns sample data.
 * Replace with a real HTTP client when the API is ready.
 */
export class MockShiftApiClient implements ShiftApiClient {
  private shifts: Shift[];

  constructor(instructorIds: string[], siteIds: string[]) {
    this.shifts = generateMockShifts(instructorIds, siteIds);
  }

  async getShiftsForInstructor(instructorId: string, from: string, to: string): Promise<Shift[]> {
    return this.shifts.filter(
      (s) => s.instructorId === instructorId && s.date >= from && s.date <= to,
    );
  }

  async getShiftById(shiftId: string): Promise<Shift | null> {
    return this.shifts.find((s) => s.shiftId === shiftId) ?? null;
  }

  async getShiftsForSite(siteId: string, date: string): Promise<Shift[]> {
    return this.shifts.filter((s) => s.siteId === siteId && s.date === date);
  }

  async getInstructorShiftOnDate(instructorId: string, date: string): Promise<Shift | null> {
    return this.shifts.find((s) => s.instructorId === instructorId && s.date === date) ?? null;
  }
}

/** Generate 2 weeks of mock shifts for each instructor. */
function generateMockShifts(instructorIds: string[], siteIds: string[]): Shift[] {
  const shifts: Shift[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const timeSlots = [
    { start: "06:00", end: "10:00" },
    { start: "10:00", end: "14:00" },
    { start: "14:00", end: "18:00" },
  ];

  let counter = 0;
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    // Skip Sundays
    if (date.getDay() === 0) continue;

    const dateStr = date.toISOString().slice(0, 10);

    for (const instructorId of instructorIds) {
      // Each instructor works ~4 days per week
      if ((dayOffset + instructorId.charCodeAt(0)) % 7 < 3) continue;

      const slot = timeSlots[counter % timeSlots.length];
      const siteId = siteIds[counter % siteIds.length] ?? "site-default";
      shifts.push({
        shiftId: `mock-shift-${++counter}`,
        instructorId,
        siteId,
        date: dateStr,
        startTime: slot.start,
        endTime: slot.end,
      });
    }
  }

  return shifts;
}
