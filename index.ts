import path from "node:path";
import type { OpenClawPluginApi } from "./api.js";
import { resolveConfig } from "./src/config.js";
import { createCoverMatcher } from "./src/cover/matcher.js";
import { createCoverRequestStore } from "./src/cover/state.js";
import { SWIM_SCHOOL_SYSTEM_PROMPT } from "./src/prompt.js";
import { InstructorRegistry } from "./src/registry.js";
import { createCoverRequestTool } from "./src/tools/cover-request.js";
import { createDocsTool } from "./src/tools/docs.js";
import { createShiftsTool } from "./src/tools/shifts.js";

export default {
  id: "swim-school",
  name: "Swim School",
  description: "WhatsApp bot for swim school instructors: shifts, docs, and cover requests.",
  configSchema: {
    safeParse(value: unknown) {
      if (value === undefined) return { success: true, data: value };
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { success: false, error: { issues: [{ path: [], message: "expected config object" }] } };
      }
      const KNOWN_KEYS = new Set([
        "instructors", "managers", "sites", "driveFolder",
        "apiMode", "apiBaseUrl", "coverRequestExpiryHours",
      ]);
      const unknown = Object.keys(value).filter((k) => !KNOWN_KEYS.has(k));
      if (unknown.length > 0) {
        return { success: false, error: { issues: [{ path: [], message: `unknown config keys: ${unknown.join(", ")}` }] } };
      }
      return { success: true, data: value };
    },
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        instructors: { type: "array" },
        managers: { type: "array" },
        sites: { type: "array" },
        driveFolder: { type: "string" },
        apiMode: { type: "string", enum: ["mock", "live"] },
        apiBaseUrl: { type: "string" },
        coverRequestExpiryHours: { type: "number" },
      },
    },
  },
  register(api: OpenClawPluginApi) {
    const cfg = resolveConfig(api.pluginConfig as Record<string, unknown> | undefined);
    const registry = new InstructorRegistry(cfg);
    const stateDir = path.join(process.env.HOME ?? "/tmp", ".openclaw", "plugins", "swim-school");
    const coverStore = createCoverRequestStore(stateDir);
    const coverMatcher = createCoverMatcher({ registry, coverStore, cfg });

    // --- Tools ---

    api.registerTool((ctx) => createShiftsTool({ cfg, registry, context: ctx }), {
      name: "swim_shifts",
    });

    api.registerTool((ctx) => createDocsTool({ cfg, registry, context: ctx, logger: api.logger }), {
      name: "swim_docs",
    });

    api.registerTool((ctx) => createCoverRequestTool({ cfg, registry, coverStore, context: ctx }), {
      name: "swim_cover_request",
    });

    // --- Stash sender identity from inbound messages ---
    const senderBySession = new Map<string, { name: string; role: string; siteIds: string[]; email: string }>();

    api.on("message_received", async (event, ctx) => {
      if (ctx.channelId !== "whatsapp") return;
      const person = registry.lookupByPhone(event.from);
      if (person && ctx.conversationId) {
        senderBySession.set(ctx.conversationId, {
          name: person.name,
          role: person.role,
          siteIds: person.siteIds,
          email: person.email,
        });
      }
      // Handle cover request responses
      await coverMatcher.handleInbound(event, ctx);
    });

    // --- Inject system prompt with sender identity ---

    api.on("before_prompt_build", async (_event, ctx) => {
      if (ctx.channelId !== "whatsapp") return;
      const sender = ctx.sessionKey ? senderBySession.get(ctx.sessionKey) : undefined;
      let prompt = SWIM_SCHOOL_SYSTEM_PROMPT;
      if (sender) {
        const sites = sender.siteIds.join(", ");
        prompt += `\n\nCurrent user: ${sender.name} (${sender.role} at ${sites}). Email: ${sender.email}.`;
      }
      return { prependSystemContext: prompt };
    });

    // --- Background service: expire stale cover requests ---

    let expiryTimer: ReturnType<typeof setInterval> | undefined;

    api.registerService({
      id: "swim-school-cover-expiry",
      async start() {
        const intervalMs = 5 * 60 * 1000;
        expiryTimer = setInterval(() => {
          coverStore.expireStale(cfg.coverRequestExpiryHours ?? 24).catch((err) => {
            api.logger.error(`Cover request expiry failed: ${err}`);
          });
        }, intervalMs);
        await coverStore.expireStale(cfg.coverRequestExpiryHours ?? 24);
      },
      async stop() {
        if (expiryTimer) clearInterval(expiryTimer);
      },
    });
  },
};
