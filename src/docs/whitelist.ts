import type { AllowedDoc } from "../types.js";

/** Check if a doc ID is in the allowed list. */
export function isDocAllowed(docId: string, allowedDocs: AllowedDoc[]): boolean {
  return allowedDocs.some((d) => d.docId === docId);
}

/** Find docs whose title contains any word from the query (case-insensitive). */
export function findMatchingDocs(query: string, allowedDocs: AllowedDoc[]): AllowedDoc[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return allowedDocs;

  return allowedDocs
    .map((doc) => {
      const titleLower = doc.title.toLowerCase();
      const categoryLower = (doc.category ?? "").toLowerCase();
      const score = words.filter((w) => titleLower.includes(w) || categoryLower.includes(w)).length;
      return { doc, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.doc);
}
