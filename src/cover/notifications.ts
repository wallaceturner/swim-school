import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { CoverRequest } from "../types.js";

const execAsync = promisify(exec);
const DRY_RUN = !!process.env.SWIM_DRY_RUN;

type Person = { name: string; phone: string };

async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const cmd = `openclaw message send --channel whatsapp --to ${phone} --body "${escapeShell(message)}"`;
  if (DRY_RUN) {
    console.error(`[swim-school][DRY_RUN] WhatsApp → ${phone}: ${message}`);
    return;
  }
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

export async function notifyCandidateInstructors(opts: {
  candidates: Person[];
  requester: Person;
  request: CoverRequest;
}): Promise<void> {
  const { candidates, requester, request } = opts;
  const message =
    `Hi! ${requester.name} needs someone to cover their shift at ${request.siteId} ` +
    `on ${request.shiftDate} from ${request.shiftStartTime} to ${request.shiftEndTime}.` +
    (request.reason ? `\nReason: ${request.reason}` : "") +
    `\n\nCan you cover this shift? Reply YES or NO.` +
    `\n(Ref: ${request.id.slice(0, 8)})`;

  for (const candidate of candidates) {
    await sendWhatsApp(candidate.phone, message);
  }
}

export async function notifyManagerCoverRequested(opts: {
  managers: Person[];
  requester: Person;
  request: CoverRequest;
}): Promise<void> {
  const { managers, requester, request } = opts;
  const message =
    `FYI: ${requester.name} has requested cover for their shift on ${request.shiftDate} ` +
    `(${request.shiftStartTime}–${request.shiftEndTime}) at ${request.siteId}. ` +
    `Other instructors have been notified.`;

  for (const mgr of managers) {
    await sendWhatsApp(mgr.phone, message);
  }
}

export async function notifyRequesterAccepted(opts: {
  requester: Person;
  coverer: Person;
  request: CoverRequest;
}): Promise<void> {
  const { requester, coverer, request } = opts;
  await sendWhatsApp(
    requester.phone,
    `Great news! ${coverer.name} has offered to cover your shift on ${request.shiftDate} ` +
      `(${request.shiftStartTime}–${request.shiftEndTime}). ` +
      `Waiting for manager approval — we'll let you know once it's confirmed.`,
  );
}

export async function notifyManagerForApproval(opts: {
  managers: Person[];
  requester: Person;
  coverer: Person;
  request: CoverRequest;
}): Promise<void> {
  const { managers, requester, coverer, request } = opts;
  const message =
    `Cover request needs your approval:\n` +
    `• ${requester.name} wants ${coverer.name} to cover their shift\n` +
    `• ${request.shiftDate} at ${request.siteId}\n` +
    `• ${request.shiftStartTime} – ${request.shiftEndTime}\n` +
    (request.reason ? `• Reason: ${request.reason}\n` : "") +
    `\nReply APPROVE or REJECT.\n(Ref: ${request.id.slice(0, 8)})`;

  for (const mgr of managers) {
    await sendWhatsApp(mgr.phone, message);
  }
}

export async function notifyFinalOutcome(opts: {
  requester: Person;
  coverer: Person;
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

export async function notifyAllDeclined(opts: {
  requester: Person;
  request: CoverRequest;
}): Promise<void> {
  const { requester, request } = opts;
  await sendWhatsApp(
    requester.phone,
    `Unfortunately, no one was available to cover your shift on ${request.shiftDate} (${request.shiftStartTime}–${request.shiftEndTime}). Please contact your manager directly.`,
  );
}

export async function notifyExpired(opts: {
  requester: Person;
  request: CoverRequest;
}): Promise<void> {
  const { requester, request } = opts;
  await sendWhatsApp(
    requester.phone,
    `Your cover request for ${request.shiftDate} has expired with no response. Please contact your manager directly.`,
  );
}
