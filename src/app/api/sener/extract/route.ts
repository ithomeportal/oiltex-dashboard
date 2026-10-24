import { fail, isResponse, ok, requireSession } from "@/lib/sener/api";
import { ExtractionError, extractLoi } from "@/lib/sener/extractor";
import { HASH_RE, findFile, readStoredBytes } from "@/lib/sener/files";
import { readWorkspace, referencedHashes } from "@/lib/sener/workspace-db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Analyze an already-registered original. Proposals are returned to the
// browser only; they become shared data when the reviewer registers them.
export async function POST(request: Request) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  let hash = "";
  try {
    const body = (await request.json()) as { hash?: unknown };
    hash = typeof body.hash === "string" ? body.hash : "";
  } catch {
    return fail("Request body must be JSON.", 400);
  }
  if (!HASH_RE.test(hash)) return fail("Invalid file reference.", 422);

  try {
    const { workspace } = await readWorkspace();
    const file = referencedHashes(workspace).has(hash) ? await findFile(hash) : null;
    if (!file) return fail("Upload the original before analyzing it.", 404);
    const bytes = await readStoredBytes(file.key);
    return ok(await extractLoi(bytes, file.mime, file.name, hash, request.signal));
  } catch (error) {
    if (request.signal.aborted) return fail("Analysis canceled.", 499);
    if (error instanceof ExtractionError) return fail(error.message, error.status);
    console.error("sener extract:", error);
    return fail("The document could not be analyzed. Please retry or enter the record manually.", 502);
  }
}
