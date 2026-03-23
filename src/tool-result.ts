/** Build a text tool result in the AgentToolResult format. */
export function textResult(text: string): {
  content: Array<{ type: "text"; text: string }>;
  details: unknown;
} {
  return { content: [{ type: "text", text }], details: undefined };
}
