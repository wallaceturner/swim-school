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

/**
 * Matches inbound WhatsApp messages against pending cover requests.
 * Handles both instructor responses (yes/no) and manager approvals.
 */
export function createCoverMatcher(opts: CoverMatcherOpts) {
  const { registry, coverStore, cfg } = opts;

  return {
    async handleInbound(event: InboundEvent, _ctx: InboundContext): Promise<void> {
      const senderPhone = extractPhone(event.from);
      if (!senderPhone) return;

      const body = (event.content ?? event.body ?? "").trim();
      if (!body) return;

      // Check if this is a manager responding to an approval request
      await handleManagerResponse(senderPhone, body);

      // Check if this is an instructor responding to a cover request
      await handleInstructorResponse(senderPhone, body);
    },
  };

  async function handleInstructorResponse(phone: string, body: string): Promise<void> {
    const pendingRequests = await coverStore.findPendingForPhone(phone);
    if (pendingRequests.length === 0) return;

    // If there are multiple pending requests, try to match by ref ID
    let target = pendingRequests[0];
    const refMatch = body.match(REF_PATTERN);
    if (refMatch) {
      const refId = refMatch[1];
      const byRef = pendingRequests.find((r) => r.id.startsWith(refId));
      if (byRef) target = byRef;
    }

    const instructor = registry.lookupByPhone(phone);
    if (!instructor) return;

    if (YES_PATTERNS.test(body)) {
      // Accept the cover request
      const updated = await coverStore.accept(target.id, instructor.instructorId);
      if (!updated) return; // Already accepted by someone else

      const requester = registry.lookupById(updated.requesterId);
      if (!requester) return;

      // Notify requester
      await notifyRequesterAccepted({ requester, coverer: instructor, request: updated });

      // Notify manager for approval
      const site = registry.getSite(updated.siteId);
      if (!site) return;

      const notified = await coverStore.notifyManager(updated.id);
      if (notified) {
        await notifyManagerForApproval({ site, requester, coverer: instructor, request: notified });
      }
    } else if (NO_PATTERNS.test(body)) {
      const updated = await coverStore.decline(target.id, phone);
      if (!updated) return;

      // Check if all notified instructors have declined
      const allDeclined = updated.notifiedInstructors.every((p) =>
        updated.declinedInstructors.includes(p),
      );
      if (allDeclined) {
        const requester = registry.lookupById(updated.requesterId);
        if (requester) {
          await notifyAllDeclined({ requester, request: updated });
        }
      }
    }
    // Ignore messages that don't match yes/no patterns
  }

  async function handleManagerResponse(phone: string, body: string): Promise<void> {
    // Check if this phone belongs to any site manager
    const sites = cfg.sites ?? [];
    const managedSite = sites.find((s) => normalizePhone(s.managerPhone) === normalizePhone(phone));
    if (!managedSite) return;

    const awaitingApproval = await coverStore.findAwaitingManagerApproval();
    // Filter to requests at this manager's site
    const relevant = awaitingApproval.filter((r) => r.siteId === managedSite.siteId);
    if (relevant.length === 0) return;

    // Match by ref ID if present, otherwise take the oldest
    let target = relevant[0];
    const refMatch = body.match(REF_PATTERN);
    if (refMatch) {
      const refId = refMatch[1];
      const byRef = relevant.find((r) => r.id.startsWith(refId));
      if (byRef) target = byRef;
    }

    const requester = registry.lookupById(target.requesterId);
    const coverer = target.coveredById ? registry.lookupById(target.coveredById) : undefined;
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
  // Handle WhatsApp JID format: 61400000000@s.whatsapp.net
  if (from.includes("@")) {
    return "+" + from.split("@")[0].split(":")[0];
  }
  return from;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]/g, "");
}
