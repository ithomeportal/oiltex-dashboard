import { fail, isResponse, ok, requireSession, serverError } from "@/lib/sener/api";
import {
  FileRejected,
  HASH_RE,
  assertSignature,
  deleteUploadThingFile,
  clearPendingUpload,
  findFile,
  indexFile,
  ownsPendingUpload,
  readStoredBytes,
  sha256,
} from "@/lib/sener/files";
import { readWorkspace, referencedHashes } from "@/lib/sener/workspace-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ hash: string }> };

function contentDisposition(kind: "inline" | "attachment", name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Serve an original — only if the LIVE workspace still references it, so a
// removed letter stops being downloadable even though its bytes are retained.
export async function GET(request: Request, { params }: Params) {
  const session = await requireSession();
  if (isResponse(session)) return session;
  const { hash } = await params;
  if (!HASH_RE.test(hash)) return fail("Invalid file reference.", 404);
  try {
    const { workspace } = await readWorkspace();
    const file = referencedHashes(workspace).has(hash) ? await findFile(hash) : null;
    if (!file) return fail("Original file is not available. Reattach it from LOI documents.", 404);
    const bytes = await readStoredBytes(file.key);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const type = file.mime.startsWith("text/") ? `${file.mime}; charset=utf-8` : file.mime;
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(bytes.length),
        "Content-Disposition": contentDisposition(download ? "attachment" : "inline", file.name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        // Text is sandboxed outright; PDFs/images need the browser viewer, which
        // a `sandbox` CSP would blank out when opened in a new tab.
        "Content-Security-Policy": file.mime.startsWith("text/")
          ? "sandbox; default-src 'none'"
          : "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'",
      },
    });
  } catch (error) {
    return serverError("file read", error);
  }
}

// Register an original the browser already uploaded to UploadThing: re-read
// the bytes server-side and only index them if their SHA-256 matches the URL.
export async function POST(request: Request, { params }: Params) {
  const session = await requireSession();
  if (isResponse(session)) return session;
  const { hash } = await params;
  if (!HASH_RE.test(hash)) return fail("Invalid SHA-256 hash.", 422);

  let body: { key?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Request body must be JSON.", 400);
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 300) : "";
  if (!key || key.length > 512 || !name) return fail("key and name are required.", 422);

  try {
    // The key comes from the browser: only accept one this user just uploaded
    // through senerUploader, never an arbitrary key in the shared app.
    if (!(await ownsPendingUpload(key, session.email))) {
      return fail("Unknown upload. Please upload the file again.", 422);
    }
    const discard = async () => {
      await deleteUploadThingFile(key);
      await clearPendingUpload(key);
    };
    const existing = await findFile(hash);
    if (existing) {
      if (existing.key !== key) await discard();
      else await clearPendingUpload(key);
      return ok({ hash, name: existing.name, mime: existing.mime, size: existing.size });
    }
    const bytes = await readStoredBytes(key);
    let mime: string;
    try {
      mime = assertSignature(bytes, name);
    } catch (error) {
      if (error instanceof FileRejected) {
        await discard();
        return fail(error.message, error.status);
      }
      throw error;
    }
    if (sha256(bytes) !== hash) {
      await discard();
      return fail("Uploaded bytes do not match the expected SHA-256; the file was rejected.", 422);
    }
    const stored = await indexFile({ hash, key, name, mime, size: bytes.length }, session.email);
    if (stored.key !== key) await discard(); // lost a concurrent same-hash race
    else await clearPendingUpload(key);
    return ok({ hash, name: stored.name, mime: stored.mime, size: stored.size });
  } catch (error) {
    return serverError("file register", error);
  }
}
