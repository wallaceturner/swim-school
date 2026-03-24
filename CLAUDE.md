# Swim School Plugin

## Deployment

- Remote: `wal@api2.investi.com.au`
- OpenClaw version on remote: 2026.3.13 (installed via npm globally at `~/.npm-global/lib/node_modules/openclaw/`)
- Plugin location on remote: `~/swim-school/`
- Linked install: `openclaw plugins install -l ~/swim-school`
- Upload command: `scp -r /opt/github/wallaceturner/swim-school/* wal@api2.investi.com.au:~/swim-school/`
- WhatsApp bot number: +61493016417
- GitHub repo: https://github.com/wallaceturner/swim-school
- OpenClaw source repo (for reference): /opt/github/openclaw

## Important: SDK Imports

External plugins MUST import from `openclaw/plugin-sdk/core` (not subpaths like `plugin-entry` or custom subpaths). The `api.ts` barrel handles this. Do not change it to use subpaths — they don't resolve on the remote's jiti loader.

The jiti runtime on the remote uses `root-alias.cjs` which is a single proxy file that lazily loads the monolithic SDK. Subpath resolution goes through an alias map built at loader time. Only subpaths with corresponding `.js` files in `dist/plugin-sdk/` work. `core.js` exists; `plugin-entry.js` does not.

## Architecture

- Single OpenClaw plugin with 3 tools: `swim_shifts`, `swim_docs`, `swim_cover_request`
- AI is locked down via `before_prompt_build` (strict system prompt) and `before_tool_call` (blocks non-swim tools)
- Instructors identified by WhatsApp phone number → registry lookup
- Shift API is mock for now (swap `apiMode` to `"live"` when ready)
- Google Docs accessed via `gw` CLI (Google Workspace CLI)
- Cover requests use JSON file persistence + proactive WhatsApp messaging
- Cover request state machine: pending → accepted → manager_notified → approved/rejected/expired

## Config

All config lives in `~/.openclaw/openclaw.json` on api2 under `plugins.entries.swim-school.config.*`:
- `instructors[]` — phone, name, email, siteId
- `sites[]` — siteId, name, suburb, managerPhone, managerName
- `allowedDocs[]` — docId, title, category
- `apiMode` — "mock" or "live"
- `apiBaseUrl` — live shift API endpoint (when ready)
- `coverRequestExpiryHours` — default 24
- `gwBinaryPath` — path to `gw` CLI binary

Instructors must also be in the WhatsApp `allowFrom` list in the channel config for the bot to accept their messages.

## OpenClaw Overview

OpenClaw is a multi-channel AI gateway with extensible messaging integrations (MIT, TypeScript/ESM).

### How the Gateway Works

- Gateway is a WebSocket-based control plane managing sessions, routing, channel connections, and tool execution
- Inbound message flow: channel receives message → access control (dmPolicy/allowlist) → route to agent → build system prompt → call LLM with tools → deliver reply
- Each conversation maps to a session with a JSONL transcript
- The AI (LLM) is configured with system prompts, tools, and function calling via the Pi Agent Core library

### Plugin System

- Plugins live under `extensions/` in the repo (bundled) or `~/.openclaw/extensions/` (user-installed)
- Entry point exports `definePluginEntry()` with a `register(api)` function
- `api` provides: `registerTool`, `registerService`, `registerHttpRoute`, `registerCommand`, `on(hookName)`, etc.
- Plugin discovery order: config-defined paths → workspace extensions → global extensions → bundled plugins
- Install methods: `openclaw plugins install <spec>` (npm, local dir, archive, or `-l` for linked)
- Manage: `openclaw plugins list`, `enable`, `disable`, `inspect`, `uninstall`

### Key Plugin Hooks

- `before_prompt_build` — inject system prompt context (receives `PluginHookAgentContext` with `channelId`)
- `before_tool_call` — block/modify tool calls (receives `PluginHookToolContext` — no `channelId`)
- `message_received` — observe inbound messages (receives `PluginHookMessageContext` with `channelId`)
- `message_sending` / `message_sent` — outbound message lifecycle

### Tool Contract

Tools implement `AgentTool` from `@mariozechner/pi-agent-core`:
- Must have: `name`, `label`, `description`, `parameters` (TypeBox schema), `execute` function
- `execute` receives `(toolCallId, params, signal?, onUpdate?)` and returns `{ content: [{ type: "text", text }], details }`
- Tools are registered via `api.registerTool(factory, { name })` where factory receives `OpenClawPluginToolContext`
- `OpenClawPluginToolContext` includes `requesterSenderId` (phone number), `sessionKey`, `agentId`, `sandboxed`, etc.

### WhatsApp Channel

- Uses Baileys library for WhatsApp Web connection
- Inbound messages normalized to include: `senderE164`, `senderJid`, `senderName`, `chatType` (direct/group), `body`, `mediaPath`, etc.
- DM policy options: `pairing`, `allowlist`, `open`, `disabled`
- Proactive outbound messaging: use `openclaw message send --channel whatsapp --to <phone> --body "<text>"`
- Active listener pattern: global singleton per account, maps to active Baileys socket
- Phone numbers in E.164 format; WhatsApp JIDs look like `61400000000@s.whatsapp.net`

### Config

- Main config: `~/.openclaw/openclaw.json` (JSON5)
- Key sections: `agents.defaults`, `channels.<provider>`, `tools.*`, `plugins.*`, `mcp.*`
- Workspace files injected into AI prompt: `AGENTS.md`, `SOUL.md`, `USER.md`, `IDENTITY.md`, `TOOLS.md`
- Located in `agents.defaults.workspace` directory (default `~/.openclaw/workspace/`)

### CLI

- Update: `openclaw update`
- Health: `openclaw health`
- Gateway: `openclaw gateway run`, `openclaw gateway restart`
- Channels: `openclaw channels status --probe`
- Config: `openclaw config set <key> <value>`
- Messages: `openclaw message send --channel whatsapp --to <phone> --body "<text>"`
- Plugins: `openclaw plugins list`, `install`, `enable`, `disable`
- Doctor: `openclaw doctor`
