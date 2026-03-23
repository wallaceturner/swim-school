import { Type } from "@sinclair/typebox";
import type { AnyAgentTool, OpenClawPluginToolContext } from "../../api.js";
import { createShiftApiClient } from "../api/client.js";
import type { InstructorRegistry } from "../registry.js";
import { textResult } from "../tool-result.js";
import type { SwimSchoolPluginConfig } from "../types.js";

function stringEnum<T extends readonly string[]>(values: T, description: string) {
  return Type.Unsafe<T[number]>({
    type: "string",
    enum: [...values],
    description,
  });
}

const PERIODS = ["today", "this_week", "next_week"] as const;

const ShiftsToolSchema = Type.Object({
  period: Type.Optional(stringEnum(PERIODS, 'Time period to query. Defaults to "this_week".')),
});

type ShiftsToolOpts = {
  cfg: SwimSchoolPluginConfig;
  registry: InstructorRegistry;
  context: OpenClawPluginToolContext;
};

export function createShiftsTool(opts: ShiftsToolOpts): AnyAgentTool {
  const { cfg, registry, context } = opts;
  const apiClient = createShiftApiClient(cfg);

  return {
    name: "swim_shifts",
    label: "Swim Shifts",
    description:
      "Look up the requesting instructor's upcoming shifts. Returns shift dates, start times, and end times.",
    parameters: ShiftsToolSchema,
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      const senderId = context.requesterSenderId;
      if (!senderId) {
        return textResult("Unable to identify you. Please contact your manager.");
      }

      const instructor = registry.lookupByPhone(senderId);
      if (!instructor) {
        return textResult(
          "Your phone number is not registered in the system. Please contact your manager to get set up.",
        );
      }

      const period = (params.period as string) ?? "this_week";
      const { from, to } = getDateRange(period);

      const shifts = await apiClient.getShiftsForInstructor(instructor.instructorId, from, to);

      if (shifts.length === 0) {
        return textResult(`No shifts found for ${instructor.name} (${period.replace("_", " ")}).`);
      }

      const site = registry.getSite(instructor.siteId);
      const siteName = site ? site.name : instructor.siteId;

      const lines = shifts.map((s) => {
        const dayName = new Date(s.date + "T00:00:00").toLocaleDateString("en-AU", {
          weekday: "long",
          day: "numeric",
          month: "short",
        });
        return `• ${dayName}: ${formatTime(s.startTime)} – ${formatTime(s.endTime)}`;
      });

      const header = `Shifts for ${instructor.name} at ${siteName} (${period.replace("_", " ")}):`;
      return textResult(`${header}\n${lines.join("\n")}`);
    },
  };
}

function getDateRange(period: string): { from: string; to: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (period === "today") {
    const d = today.toISOString().slice(0, 10);
    return { from: d, to: d };
  }

  if (period === "next_week") {
    const monday = new Date(today);
    monday.setDate(monday.getDate() + (7 - monday.getDay() + 1));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
  }

  // this_week (default): Monday through Sunday of current week
  const monday = new Date(today);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = Number.parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}
