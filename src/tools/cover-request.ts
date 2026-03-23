import { Type } from "@sinclair/typebox";
import type { AnyAgentTool, OpenClawPluginToolContext } from "../../api.js";
import { createShiftApiClient } from "../api/client.js";
import { notifyCandidateInstructors } from "../cover/notifications.js";
import type { CoverRequestStore } from "../cover/state.js";
import type { InstructorRegistry } from "../registry.js";
import { textResult } from "../tool-result.js";
import type { SwimSchoolPluginConfig } from "../types.js";

const CoverRequestToolSchema = Type.Object({
  date: Type.String({
    description: "Date of the shift to cover (YYYY-MM-DD format).",
  }),
  startTime: Type.Optional(
    Type.String({
      description:
        "Start time of the shift (HH:mm). Helps disambiguate if multiple shifts on the same day.",
    }),
  ),
  reason: Type.Optional(Type.String({ description: "Optional reason for needing cover." })),
});

type CoverRequestToolOpts = {
  cfg: SwimSchoolPluginConfig;
  registry: InstructorRegistry;
  coverStore: CoverRequestStore;
  context: OpenClawPluginToolContext;
};

export function createCoverRequestTool(opts: CoverRequestToolOpts): AnyAgentTool {
  const { cfg, registry, coverStore, context } = opts;
  const apiClient = createShiftApiClient(cfg);

  return {
    name: "swim_cover_request",
    label: "Swim Cover Request",
    description:
      "Request someone to cover your shift. Notifies other instructors at your site and coordinates manager approval.",
    parameters: CoverRequestToolSchema,
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      const senderId = context.requesterSenderId;
      if (!senderId) {
        return textResult("Unable to identify you. Please contact your manager.");
      }

      const instructor = registry.lookupByPhone(senderId);
      if (!instructor) {
        return textResult("Your phone number is not registered. Please contact your manager.");
      }

      const date = params.date as string;
      const startTime = params.startTime as string | undefined;
      const reason = params.reason as string | undefined;

      const shift = await apiClient.getInstructorShiftOnDate(instructor.instructorId, date);
      if (!shift) {
        return textResult(
          `No shift found for you on ${date}. Please check the date and try again.`,
        );
      }

      if (startTime && shift.startTime !== startTime) {
        return textResult(
          `Your shift on ${date} starts at ${shift.startTime}, not ${startTime}. Please confirm the correct shift.`,
        );
      }

      const site = registry.getSite(shift.siteId ?? instructor.siteId);
      if (!site) {
        return textResult("Could not find your site. Please contact your manager.");
      }

      const candidates = registry.getSiteInstructors(site.siteId, instructor.instructorId);
      if (candidates.length === 0) {
        return textResult(
          "There are no other instructors registered at your site to ask. Please contact your manager directly.",
        );
      }

      const request = await coverStore.create({
        requesterId: instructor.instructorId,
        shiftId: shift.shiftId,
        siteId: site.siteId,
        shiftDate: shift.date,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        notifiedInstructors: candidates.map((c) => c.phone),
        reason,
      });

      await notifyCandidateInstructors({
        candidates,
        requester: instructor,
        request,
        site,
      });

      const names = candidates.map((c) => c.name).join(", ");
      return textResult(
        `Cover request created for your shift on ${shift.date} (${shift.startTime}–${shift.endTime}) at ${site.name}.\n` +
          `I've messaged ${candidates.length} instructor(s): ${names}.\n` +
          `I'll let you know when someone responds. Your manager will need to approve the swap.`,
      );
    },
  };
}
