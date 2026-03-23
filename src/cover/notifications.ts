import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Instructor, Site, CoverRequest } from "../types.js";

const execAsync = promisify(exec);

/**
 * Send a WhatsApp message to a phone number using the openclaw CLI.
 * This is the simplest reliable approach — it uses the gateway's existing
 * WhatsApp connection via `openclaw message send`.
 */
async function sendWhatsApp(phone: string, message: string): Promise<void> {
  // Use heredoc to safely pass message content with special characters
  const cmd = `openclaw message send --channel whatsapp --to ${phone} --body "${escapeShell(message)}"`;
  try {
    await execAsync(cmd, { timeout: 30_000 });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to send WhatsApp to ${phone}: ${errMsg}`);
  }
}

function escapeShell(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/`/g, "\\`");
}

/** Notify candidate instructors about a cover request. */
export async function notifyCandidateInstructors(opts: {
  candidates: Instructor[];
  requester: Instructor;
  request: CoverRequest;
  site: Site;
}): Promise<void> {
  const { candidates, requester, request, site } = opts;
  const message =
    `Hi! ${requester.name} needs someone to cover their shift at ${site.name} (${site.suburb}) ` +
    `on ${request.shiftDate} from ${request.shiftStartTime} to ${request.shiftEndTime}.` +
    (request.reason ? `\nReason: ${request.reason}` : "") +
    `\n\nCan you cover this shift? Reply YES or NO.` +
    `\n(Ref: ${request.id.slice(0, 8)})`;

  for (const candidate of candidates) {
    await sendWhatsApp(candidate.phone, message);
  }
}

/** Notify the requester that someone has accepted their cover request. */
export async function notifyRequesterAccepted(opts: {
  requester: Instructor;
  coverer: Instructor;
  request: CoverRequest;
}): Promise<void> {
  const { requester, coverer, request } = opts;
  const message =
    `Great news! ${coverer.name} has offered to cover your shift on ${request.shiftDate} ` +
    `(${request.shiftStartTime}–${request.shiftEndTime}). ` +
    `Waiting for manager approval — we'll let you know once it's confirmed.`;

  await sendWhatsApp(requester.phone, message);
}

/** Notify the site manager that a cover swap needs approval. */
export async function notifyManagerForApproval(opts: {
  site: Site;
  requester: Instructor;
  coverer: Instructor;
  request: CoverRequest;
}): Promise<void> {
  const { site, requester, coverer, request } = opts;
  const message =
    `Cover request needs your approval:\n` +
    `• ${requester.name} wants ${coverer.name} to cover their shift\n` +
    `• ${request.shiftDate} at ${site.name} (${site.suburb})\n` +
    `• ${request.shiftStartTime} – ${request.shiftEndTime}\n` +
    (request.reason ? `• Reason: ${request.reason}\n` : "") +
    `\nReply APPROVE or REJECT.\n(Ref: ${request.id.slice(0, 8)})`;

  await sendWhatsApp(site.managerPhone, message);
}

/** Notify both parties of the final approval/rejection. */
export async function notifyFinalOutcome(opts: {
  requester: Instructor;
  coverer: Instructor;
  request: CoverRequest;
  approved: boolean;
}): Promise<void> {
  const { requester, coverer, request, approved } = opts;

  if (approved) {
    await sendWhatsApp(
      requester.phone,
      `Your shift cover on ${request.shiftDate} (${request.shiftStartTime}–${request.shiftEndTime}) has been approved! ${coverer.name} will cover for you.`,
    );
    await sendWhatsApp(
      coverer.phone,
      `You've been confirmed to cover ${requester.name}'s shift on ${request.shiftDate} (${request.shiftStartTime}–${request.shiftEndTime}). Thanks for helping out!`,
    );
  } else {
    await sendWhatsApp(
      requester.phone,
      `Sorry, the manager did not approve the shift cover on ${request.shiftDate}. Please contact your manager directly.`,
    );
    await sendWhatsApp(
      coverer.phone,
      `The manager did not approve the cover request for ${request.shiftDate}. No action needed from you.`,
    );
  }
}

/** Notify the requester that all candidates declined. */
export async function notifyAllDeclined(opts: {
  requester: Instructor;
  request: CoverRequest;
}): Promise<void> {
  const { requester, request } = opts;
  await sendWhatsApp(
    requester.phone,
    `Unfortunately, no one was available to cover your shift on ${request.shiftDate} (${request.shiftStartTime}–${request.shiftEndTime}). Please contact your manager directly.`,
  );
}

/** Notify the requester that a cover request has expired. */
export async function notifyExpired(opts: {
  requester: Instructor;
  request: CoverRequest;
}): Promise<void> {
  const { requester, request } = opts;
  await sendWhatsApp(
    requester.phone,
    `Your cover request for ${request.shiftDate} has expired with no response. Please contact your manager directly.`,
  );
}
