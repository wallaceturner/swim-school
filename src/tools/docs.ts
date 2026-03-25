import { Type } from "@sinclair/typebox";
import type { AnyAgentTool, OpenClawPluginToolContext, PluginLogger } from "../../api.js";
import { emailDoc } from "../docs/gw-client.js";
import { getDocsInFolder, getCachedDocContent, matchDocsByQuery } from "../docs/folder.js";
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
    '"query" to search/read documents. "email_pdf" to email a document to the instructor.',
  ),
  query: Type.String({
    description:
      "Search query, question, or document name. For email_pdf, use the document name to identify which doc to send.",
  }),
});

type DocsToolOpts = {
  cfg: SwimSchoolPluginConfig;
  registry: InstructorRegistry;
  context: OpenClawPluginToolContext;
  logger: PluginLogger;
};

export function createDocsTool(opts: DocsToolOpts): AnyAgentTool {
  const { cfg, registry, context, logger } = opts;
  const gwsBinary = "gws";
  const folderName = cfg.driveFolder ?? "instructors";

  return {
    name: "swim_docs",
    label: "Swim Docs",
    description:
      'Search learn-to-swim documents, answer questions about them, or email a document as PDF. Use action "query" to search/read, "email_pdf" to email a doc.',
    parameters: DocsToolSchema,
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      const senderId = context.requesterSenderId;
      if (!senderId) {
        return textResult("Unable to identify you. Please contact your manager.");
      }

      const instructor = registry.lookupByPhone(senderId);
      const isKnown = instructor || registry.isKnownPerson(senderId);
      if (!isKnown) {
        return textResult("Your phone number is not registered. Please contact your manager.");
      }

      const action = (params.action as string) ?? "query";
      const query = params.query as string;
      logger.info(`swim_docs called: action="${action}" query="${query}" sender=${senderId}`);

      try {
        const files = await getDocsInFolder(folderName, gwsBinary);
        logger.info(`swim_docs: found ${files.length} files in folder "${folderName}"`);

        if (files.length === 0) {
          return textResult("No documents found in the instructors folder.");
        }

        if (action === "email_pdf") {
          if (!instructor?.email) {
            return textResult("No email address on file for you. Please contact your manager.");
          }

          const matches = matchDocsByQuery(query, files);
          if (matches.length === 0) {
            const list = files.map((f) => `• ${f.name}`).join("\n");
            return textResult(
              `No documents matched "${query}". Available documents:\n${list}`,
            );
          }

          const doc = matches[0];
          logger.info(`swim_docs: emailing "${doc.name}" to ${instructor.email}`);
          const result = await emailDoc(doc.id, doc.name, instructor.email, { gwsBinary });
          return textResult(result);
        }

        // action === "query"
        const listKeywords = ["list", "what documents", "available", "show all", "all docs"];
        if (listKeywords.some((kw) => query.toLowerCase().includes(kw))) {
          const list = files.map((f) => `• ${f.name}`).join("\n");
          return textResult(
            `Documents in the instructors folder:\n${list}\n\nAsk me a question about any of these, or ask me to email one as PDF.`,
          );
        }

        const matches = matchDocsByQuery(query, files);

        if (matches.length === 0) {
          const list = files.map((f) => `• ${f.name}`).join("\n");
          return textResult(
            `No documents matched your query. Available documents:\n${list}\n\nTry asking about one of these by name.`,
          );
        }

        const doc = matches[0];
        const content = await getCachedDocContent(doc.id, gwsBinary);

        return textResult(`From "${doc.name}":\n\n${content}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`swim_docs error: ${message}`);
        return textResult(`Error accessing documents: ${message}`);
      }
    },
  };
}
