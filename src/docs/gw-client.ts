import { exec } from "node:child_process";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const MAX_CONTENT_LENGTH = 8000;

/** Writable directory for temp exports — gws blocks writes outside cwd. */
const CACHE_DIR = path.join(process.env.HOME ?? "/tmp", ".openclaw", "plugins", "swim-school", "cache");
fs.mkdirSync(CACHE_DIR, { recursive: true });

type GwsOpts = {
  gwsBinary: string;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

function shellEscapeJson(params: Record<string, unknown>): string {
  // Escape single quotes in JSON by ending the single-quoted string, adding an escaped quote, and restarting
  const json = JSON.stringify(params);
  return `'${json.replace(/'/g, "'\\''")}'`;
}

/** Find a Drive folder by name and return its ID. */
export async function findFolderByName(
  folderName: string,
  opts: GwsOpts,
): Promise<string | null> {
  const q = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const cmd = `${opts.gwsBinary} drive files list --params ${shellEscapeJson({ q, pageSize: 5, fields: "files(id,name)" })}`;
  console.error(`[swim-school] exec: ${cmd}`);
  const { stdout, stderr } = await execAsync(cmd, { timeout: 30_000 });
  if (stderr) console.error(`[swim-school] stderr: ${stderr}`);
  console.error(`[swim-school] stdout: ${stdout.slice(0, 500)}`);
  const data = JSON.parse(stdout);
  const files = data.files ?? [];
  return files.length > 0 ? files[0].id : null;
}

/** List all files (docs, sheets, etc.) inside a Drive folder. */
export async function listFolderContents(
  folderId: string,
  opts: GwsOpts,
): Promise<DriveFile[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const cmd = `${opts.gwsBinary} drive files list --params ${shellEscapeJson({ q, pageSize: 100, fields: "files(id,name,mimeType)" })}`;
  console.error(`[swim-school] exec: ${cmd}`);
  const { stdout, stderr } = await execAsync(cmd, { timeout: 30_000 });
  if (stderr) console.error(`[swim-school] stderr: ${stderr}`);
  console.error(`[swim-school] stdout: ${stdout.slice(0, 500)}`);
  const data = JSON.parse(stdout);
  return (data.files ?? []) as DriveFile[];
}

/** Fetch the text content of a Google Doc by exporting as plain text. */
export async function fetchDocContent(
  fileId: string,
  opts: GwsOpts,
): Promise<string> {
  const outPath = path.join(CACHE_DIR, `${fileId}.txt`);
  try {
    const cmd = `${opts.gwsBinary} drive files export --params ${shellEscapeJson({ fileId, mimeType: "text/plain" })} --output ${outPath}`;
    console.error(`[swim-school] exec: ${cmd}`);
    await execAsync(cmd, { timeout: 30_000, cwd: CACHE_DIR });

    const content = await readFile(outPath, "utf-8");

    if (content.length > MAX_CONTENT_LENGTH) {
      return (
        content.slice(0, MAX_CONTENT_LENGTH) +
        "\n\n[Content truncated — ask for specific sections or request the full PDF via email.]"
      );
    }
    return content;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[swim-school] fetchDocContent error: ${message}`);
    return `Failed to fetch document content: ${message}`;
  }
}

/** Email a Google Doc's content to the recipient as plain text. */
export async function emailDoc(
  fileId: string,
  docName: string,
  recipientEmail: string,
  opts: GwsOpts,
): Promise<string> {
  try {
    // First get the text content (uses cache if available)
    const content = await fetchDocContent(fileId, opts);
    if (content.startsWith("Failed to fetch")) {
      return content;
    }

    // Email the content as body text
    const subject = `Swim School: ${docName}`.replace(/'/g, "'\\''");
    const bodyFile = path.join(CACHE_DIR, `${fileId}-email-body.txt`);
    fs.writeFileSync(bodyFile, content, "utf-8");

    // Read from file to avoid shell escaping issues with doc content
    const bodyContent = fs.readFileSync(bodyFile, "utf-8").replace(/'/g, "'\\''");
    const sendCmd = `${opts.gwsBinary} gmail +send --to ${recipientEmail} --subject '${subject}' --body '${bodyContent}'`;
    console.error(`[swim-school] exec: gws gmail +send --to ${recipientEmail} --subject '${subject}' --body '<${content.length} chars>'`);
    await execAsync(sendCmd, { timeout: 60_000 });

    return `"${docName}" has been emailed to ${recipientEmail}.`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[swim-school] emailDoc error: ${message}`);
    return `Failed to email document: ${message}`;
  }
}
