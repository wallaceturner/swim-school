import { Type } from "@sinclair/typebox";
import type { AnyAgentTool, OpenClawPluginToolContext } from "../../api.js";
import { fetchDocContent, exportAndEmailPdf } from "../docs/gw-client.js";
import { isDocAllowed, findMatchingDocs } from "../docs/whitelist.js";
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

const ACTIONS = ["query", "email_pdf"] as const;

const DocsToolSchema = Type.Object({
  action: stringEnum(
    ACTIONS,
    '"query" to search and return content from approved docs. "email_pdf" to send a specific doc as PDF to your email.',
  ),
  query: Type.Optional(
    Type.String({ description: "Search query or question about learn-to-swim programs." }),
  ),
  docId: Type.Optional(
    Type.String({ description: "Google Doc ID to email as PDF. Required for email_pdf action." }),
  ),
});

type DocsToolOpts = {
  cfg: SwimSchoolPluginConfig;
  registry: InstructorRegistry;
  context: OpenClawPluginToolContext;
};

export function createDocsTool(opts: DocsToolOpts): AnyAgentTool {
  const { cfg, registry, context } = opts;

  return {
    name: "swim_docs",
    label: "Swim Docs",
    description:
      'Search approved learn-to-swim program documents or email a PDF to the instructor. Use action "query" to search, "email_pdf" to send a document.',
    parameters: DocsToolSchema,
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      const senderId = context.requesterSenderId;
      if (!senderId) {
        return textResult("Unable to identify you. Please contact your manager.");
      }

      const instructor = registry.lookupByPhone(senderId);
      if (!instructor) {
        return textResult("Your phone number is not registered. Please contact your manager.");
      }

      const action = params.action as string;
      const allowedDocs = cfg.allowedDocs ?? [];

      if (action === "email_pdf") {
        const docId = params.docId as string | undefined;
        if (!docId) {
          return textResult("Please specify which document to email (docId).");
        }
        if (!isDocAllowed(docId, allowedDocs)) {
          return textResult(
            "That document is not available. Please choose from the approved documents.",
          );
        }
        if (!instructor.email) {
          return textResult("No email address on file for you. Please contact your manager.");
        }

        const result = await exportAndEmailPdf({
          docId,
          recipientEmail: instructor.email,
          gwBinary: cfg.gwBinaryPath ?? "gw",
        });

        return textResult(result);
      }

      // action === "query"
      const query = params.query as string | undefined;
      if (!query) {
        if (allowedDocs.length === 0) {
          return textResult("No documents are currently available.");
        }
        const list = allowedDocs
          .map((d) => `• ${d.title}${d.category ? ` (${d.category})` : ""} — ID: ${d.docId}`)
          .join("\n");
        return textResult(
          `Available learn-to-swim documents:\n${list}\n\nAsk me a question about any of these, or request a PDF by ID.`,
        );
      }

      const matches = findMatchingDocs(query, allowedDocs);
      if (matches.length === 0) {
        return textResult(
          "No matching documents found. Try a different search term, or ask me to list available documents.",
        );
      }

      const doc = matches[0];
      const content = await fetchDocContent({
        docId: doc.docId,
        gwBinary: cfg.gwBinaryPath ?? "gw",
      });

      return textResult(`From "${doc.title}":\n\n${content}`);
    },
  };
}
