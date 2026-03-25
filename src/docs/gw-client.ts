import { exec } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const MAX_CONTENT_LENGTH = 8000;

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
  const outPath = path.join(tmpdir(), `swim-school-${fileId}.txt`);
  try {
    const cmd = `${opts.gwsBinary} drive files export --params ${shellEscapeJson({ fileId, mimeType: "text/plain" })} --output ${outPath}`;
    console.error(`[swim-school] exec: ${cmd}`);
    await execAsync(cmd, { timeout: 30_000 });

    const { readFile } = await import("node:fs/promises");
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

/** Export a Google Doc as PDF and email it to the recipient. */
export async function exportAndEmailPdf(
  fileId: string,
  docName: string,
  recipientEmail: string,
  opts: GwsOpts,
): Promise<string> {
  const pdfPath = path.join(tmpdir(), `swim-school-${fileId}.pdf`);
  try {
    // Export as PDF
    const exportCmd = `${opts.gwsBinary} drive files export --params ${shellEscapeJson({ fileId, mimeType: "application/pdf" })} --output ${pdfPath}`;
    console.error(`[swim-school] exec: ${exportCmd}`);
    await execAsync(exportCmd, { timeout: 60_000 });

    // Email via gws gmail helper
    const subject = `Swim School: ${docName}`.replace(/'/g, "'\\''");
    const sendCmd = `${opts.gwsBinary} gmail +send --to ${recipientEmail} --subject '${subject}' --body 'Please find the requested document attached.' -a ${pdfPath}`;
    console.error(`[swim-school] exec: ${sendCmd}`);
    await execAsync(sendCmd, { timeout: 60_000 });

    return `PDF of "${docName}" has been emailed to ${recipientEmail}.`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[swim-school] exportAndEmailPdf error: ${message}`);
    return `Failed to send PDF: ${message}`;
  }
}
