import { findFolderByName, listFolderContents } from "./gw-client.js";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

type FolderCacheEntry = {
  folderId: string;
  files: DriveFile[];
  fetchedAt: number;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cache: FolderCacheEntry | null = null;

/** Resolve the folder and list its docs, with a short TTL cache. */
export async function getDocsInFolder(
  folderName: string,
  gwsBinary: string,
): Promise<DriveFile[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.files;
  }

  const folderId = await findFolderByName(folderName, { gwsBinary });
  if (!folderId) {
    throw new Error(`Drive folder "${folderName}" not found.`);
  }

  const files = await listFolderContents(folderId, { gwsBinary });
  cache = { folderId, files, fetchedAt: now };
  return files;
}

/** Find docs in the folder whose name matches the query (case-insensitive). */
export function matchDocsByQuery(query: string, files: DriveFile[]): DriveFile[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return files;

  return files
    .map((file) => {
      const nameLower = file.name.toLowerCase();
      const score = words.filter((w) => nameLower.includes(w)).length;
      return { file, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.file);
}
