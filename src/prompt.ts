/**
 * Dynamic sender identity context injected via before_prompt_build.
 * Static personality/rules/tool routing is in workspace files (IDENTITY.md, SOUL.md, TOOLS.md).
 */
export function buildSenderContext(sender: { name: string; role: string; siteIds: string[]; email: string }): string {
  const sites = sender.siteIds.join(", ");
  return `Current user: ${sender.name} (${sender.role} at ${sites}). Email: ${sender.email}.`;
}
