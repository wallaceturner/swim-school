import { Type } from "@sinclair/typebox";
import type { AnyAgentTool, OpenClawPluginToolContext, PluginLogger } from "../../api.js";
import { fetchDocContent } from "../docs/gw-client.js";
import { getDocsInFolder, matchDocsByQuery } from "../docs/folder.js";
import type { InstructorRegistry } from "../registry.js";
import { textResult } from "../tool-result.js";
import type { SwimSchoolPluginConfig } from "../types.js";

const DocsToolSchema = Type.Object({
  query: Type.String({
    description:
      "Search query or question about learn-to-swim programs. Use this to find and read documents from the shared instructors folder.",
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
      "Search learn-to-swim program documents from the shared instructors folder. Ask a question or search by document name.",
    parameters: DocsToolSchema,
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      const senderId = context.requesterSenderId;
      if (!senderId) {
        return textResult("Unable to identify you. Please contact your manager.");
      }

      if (!registry.isKnownPerson(senderId)) {
        return textResult("Your phone number is not registered. Please contact your manager.");
      }

      const query = params.query as string;
      logger.info(`swim_docs called: query="${query}" sender=${senderId}`);

      try {
        const files = await getDocsInFolder(folderName, gwsBinary);
        logger.info(`swim_docs: found ${files.length} files in folder "${folderName}"`);

        if (files.length === 0) {
          return textResult("No documents found in the instructors folder.");
        }

        // If the query is generic like "list" or "what documents", show all files
        const listKeywords = ["list", "what documents", "available", "show all", "all docs"];
        if (listKeywords.some((kw) => query.toLowerCase().includes(kw))) {
          const list = files.map((f) => `• ${f.name}`).join("\n");
          return textResult(
            `Documents in the instructors folder:\n${list}\n\nAsk me a question about any of these.`,
          );
        }

        // Find matching docs by name
        const matches = matchDocsByQuery(query, files);

        if (matches.length === 0) {
          // No name match — fetch the best candidate or show the list
          const list = files.map((f) => `• ${f.name}`).join("\n");
          return textResult(
            `No documents matched your query. Available documents:\n${list}\n\nTry asking about one of these by name.`,
          );
        }

        // Fetch content of the best match
        const doc = matches[0];
        const content = await fetchDocContent(doc.id, { gwsBinary });

        return textResult(`From "${doc.name}":\n\n${content}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`swim_docs error: ${message}`);
        return textResult(`Error accessing documents: ${message}`);
      }
    },
  };
}
