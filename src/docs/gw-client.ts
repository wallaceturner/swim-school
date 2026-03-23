import { exec } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);
const MAX_CONTENT_LENGTH = 8000;

type FetchDocOpts = {
  docId: string;
  gwBinary: string;
};

type EmailPdfOpts = {
  docId: string;
  recipientEmail: string;
  gwBinary: string;
};

/** Fetch the text content of a Google Doc via the gw CLI. */
export async function fetchDocContent(opts: FetchDocOpts): Promise<string> {
  const { docId, gwBinary } = opts;
  try {
    const { stdout } = await execAsync(`${gwBinary} docs get ${docId} --format text`, {
      timeout: 30_000,
    });
    // Truncate to avoid overwhelming the context
    if (stdout.length > MAX_CONTENT_LENGTH) {
      return (
        stdout.slice(0, MAX_CONTENT_LENGTH) +
        "\n\n[Content truncated — ask for specific sections or request the full PDF via email.]"
      );
    }
    return stdout;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Failed to fetch document content: ${message}`;
  }
}

/** Export a Google Doc as PDF and email it to the recipient. */
export async function exportAndEmailPdf(opts: EmailPdfOpts): Promise<string> {
  const { docId, recipientEmail, gwBinary } = opts;
  const pdfPath = path.join(tmpdir(), `swim-school-${docId}.pdf`);
  try {
    // Export to PDF
    await execAsync(`${gwBinary} docs export ${docId} --format pdf --output ${pdfPath}`, {
      timeout: 60_000,
    });

    // Email the PDF
    await execAsync(
      `${gwBinary} gmail send --to ${recipientEmail} --subject "Learn to Swim Program Document" --body "Please find the requested document attached." --attachment ${pdfPath}`,
      { timeout: 60_000 },
    );

    return `PDF has been emailed to ${recipientEmail}. Please check your inbox.`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Failed to send PDF: ${message}`;
  }
}
