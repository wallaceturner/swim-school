import type { InstructorRegistry } from "../registry.js";
import type { SwimSchoolPluginConfig } from "../types.js";
import {
  notifyRequesterAccepted,
  notifyManagerForApproval,
  notifyFinalOutcome,
  notifyAllDeclined,
} from "./notifications.js";
import type { CoverRequestStore } from "./state.js";

const YES_PATTERNS = /^(yes|yep|yeah|sure|ok|okay|can do|i can|available|y)\b/i;
const NO_PATTERNS = /^(no|nope|nah|can't|cannot|cant|sorry|unavailable|n)\b/i;
const APPROVE_PATTERNS = /^(approve|approved|yes|confirm|confirmed|ok|okay)\b/i;
const REJECT_PATTERNS = /^(reject|rejected|no|deny|denied|decline)\b/i;
const REF_PATTERN = /\(Ref:\s*([a-f0-9]{8})\)/i;

type InboundEvent = {
  from?: string;
  content?: string;
  body?: string;
  [key: string]: unknown;
};

type InboundContext = {
  channelId?: string;
  [key: string]: unknown;
};

type CoverMatcherOpts = {
  registry: InstructorRegistry;
  coverStore: CoverRequestStore;
  cfg: SwimSchoolPluginConfig;
};

export function createCoverMatcher(opts: CoverMatcherOpts) {
  const { registry, coverStore } = opts;

  return {
    async handleInbound(event: InboundEvent, _ctx: InboundContext): Promise<void> {
      const senderPhone = extractPhone(event.from);
      if (!senderPhone) return;

      const body = (event.content ?? event.body ?? "").trim();
      if (!body) return;

      await handleManagerResponse(senderPhone, body);
      await handleInstructorResponse(senderPhone, body);
    },
  };

  async function handleInstructorResponse(phone: string, body: string): Promise<void> {
    const pendingRequests = await coverStore.findPendingForPhone(phone);
    if (pendingRequests.length === 0) return;

    let target = pendingRequests[0];
    const refMatch = body.match(REF_PATTERN);
    if (refMatch) {
      const byRef = pendingRequests.find((r) => r.id.startsWith(refMatch[1]));
      if (byRef) target = byRef;
    }

    const person = registry.lookupByPhone(phone);
    if (!person) return;

    if (YES_PATTERNS.test(body)) {
      const updated = await coverStore.accept(target.id, person.email);
      if (!updated) return;

      const requester = registry.lookupByEmail(updated.requesterId);
      if (!requester) return;

      await notifyRequesterAccepted({ requester, coverer: person, request: updated });

      const notified = await coverStore.notifyManager(updated.id);
      if (notified) {
        const managers = registry.getManagersForSite(updated.siteId);
        if (managers.length > 0) {
          await notifyManagerForApproval({ managers, requester, coverer: person, request: notified });
        }
      }
    } else if (NO_PATTERNS.test(body)) {
      const updated = await coverStore.decline(target.id, phone);
      if (!updated) return;

      const allDeclined = updated.notifiedInstructors.every((p) =>
        updated.declinedInstructors.includes(p),
      );
      if (allDeclined) {
        const requester = registry.lookupByEmail(updated.requesterId);
        if (requester) {
          await notifyAllDeclined({ requester, request: updated });
        }
      }
    }
  }

  async function handleManagerResponse(phone: string, body: string): Promise<void> {
    const manager = registry.lookupByPhone(phone);
    if (!manager || manager.role !== "manager") return;

    const awaitingApproval = await coverStore.findAwaitingManagerApproval();
    const relevant = awaitingApproval.filter((r) => manager.siteIds.includes(r.siteId));
    if (relevant.length === 0) return;

    let target = relevant[0];
    const refMatch = body.match(REF_PATTERN);
    if (refMatch) {
      const byRef = relevant.find((r) => r.id.startsWith(refMatch[1]));
      if (byRef) target = byRef;
    }

    const requester = registry.lookupByEmail(target.requesterId);
    const coverer = target.coveredById ? registry.lookupByEmail(target.coveredById) : undefined;
    if (!requester || !coverer) return;

    if (APPROVE_PATTERNS.test(body)) {
      const approved = await coverStore.approve(target.id);
      if (approved) {
        await notifyFinalOutcome({ requester, coverer, request: approved, approved: true });
      }
    } else if (REJECT_PATTERNS.test(body)) {
      const rejected = await coverStore.reject(target.id);
      if (rejected) {
        await notifyFinalOutcome({ requester, coverer, request: rejected, approved: false });
      }
    }
  }
}

function extractPhone(from: string | undefined): string | undefined {
  if (!from) return undefined;
  if (from.includes("@")) {
    return "+" + from.split("@")[0].split(":")[0];
  }
  return from;
}
