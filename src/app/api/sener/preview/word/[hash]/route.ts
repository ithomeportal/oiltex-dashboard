import mammoth from "mammoth";
import { fail, isResponse, ok, requireSession, serverError } from "@/lib/sener/api";
import { HASH_RE, findFile, readStoredBytes } from "@/lib/sener/files";
import { readWorkspace, referencedHashes } from "@/lib/sener/workspace-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Word preview as HTML (Manus used LibreOffice → PDF, which Vercel can't run).
// The client renders it in a sandboxed iframe, so embedded links/scripts are inert.
export async function GET(_request: Request, { params }: { params: Promise<{ hash: string }> }) {
  const session = await requireSession();
  if (isResponse(session)) return session;
  const { hash } = await params;
  if (!HASH_RE.test(hash)) return fail("Invalid file reference.", 404);
  try {
    const { workspace } = await readWorkspace();
    const file = referencedHashes(workspace).has(hash) ? await findFile(hash) : null;
    if (!file) return fail("Original file is not available.", 404);
    if (file.mime !== DOCX) return fail("Preview is only available for Word (.docx) files.", 422);
    const bytes = await readStoredBytes(file.key);
    const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(bytes) });
    const html =
      '<!doctype html><meta charset="utf-8"><style>body{font:15px/1.5 system-ui,sans-serif;margin:24px;color:#1e293b}' +
      "table{border-collapse:collapse}td,th{border:1px solid #cbd5e1;padding:4px 8px}img{max-width:100%}</style>" +
      value;
    return ok({ html });
  } catch (error) {
    return serverError("word preview", error);
  }
}
