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

const ALLOWED_TOOLS = new Set(["swim_shifts", "swim_docs", "swim_cover_request"]);

export default {
  id: "swim-school",
  name: "Swim School",
  description: "WhatsApp bot for swim school instructors: shifts, docs, and cover requests.",
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

    api.registerTool((ctx) => createDocsTool({ cfg, registry, context: ctx }), {
      name: "swim_docs",
    });

    api.registerTool((ctx) => createCoverRequestTool({ cfg, registry, coverStore, context: ctx }), {
      name: "swim_cover_request",
    });

    // --- Lockdown: strict system prompt ---

    api.on("before_prompt_build", async (_event, ctx) => {
      if (ctx.channelId !== "whatsapp") return;
      return { prependSystemContext: SWIM_SCHOOL_SYSTEM_PROMPT };
    });

    // --- Lockdown: block non-swim-school tools ---
    // Note: PluginHookToolContext doesn't carry channelId, so we block
    // unconditionally for any non-swim-school tool. Since this plugin is only
    // meant for the swim school bot, this is the desired behavior.

    api.on("before_tool_call", async (event) => {
      if (!ALLOWED_TOOLS.has(event.toolName)) {
        return { block: true, blockReason: "Only swim school tools are permitted." };
      }
      return undefined;
    });

    // --- Cover request inbound matching ---

    api.on("message_received", async (event, ctx) => {
      if (ctx.channelId !== "whatsapp") return;
      await coverMatcher.handleInbound(event, ctx);
    });

    // --- Background service: expire stale cover requests ---

    let expiryTimer: ReturnType<typeof setInterval> | undefined;

    api.registerService({
      id: "swim-school-cover-expiry",
      async start() {
        const intervalMs = 5 * 60 * 1000; // 5 minutes
        expiryTimer = setInterval(() => {
          coverStore.expireStale(cfg.coverRequestExpiryHours ?? 24).catch((err) => {
            api.logger.error(`Cover request expiry failed: ${err}`);
          });
        }, intervalMs);
        // Run once on startup
        await coverStore.expireStale(cfg.coverRequestExpiryHours ?? 24);
      },
      async stop() {
        if (expiryTimer) clearInterval(expiryTimer);
      },
    });
  },
};
