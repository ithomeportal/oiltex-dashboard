import { fail, isResponse, ok, requireSession, serverError } from "@/lib/sener/api";
import type { SenerWorkspace } from "@/lib/sener/types";
import { SenerValidationError, validateWorkspace } from "@/lib/sener/validate";
import { RevisionConflict, readWorkspace, replaceWorkspace } from "@/lib/sener/workspace-db";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4 * 1024 * 1024;

// Clearing — or nearly clearing — the shared register is admin-only. A single
// dropped line is a normal edit; losing over half of a non-trivial list is not.
// (Every revision is also kept in sener_workspace_history for recovery.)
function removesMost(before: number, after: number): boolean {
  return before > 0 && (after === 0 || (before >= 4 && after < before / 2));
}

function isMassRemoval(current: SenerWorkspace, next: SenerWorkspace): boolean {
  return (
    removesMost(current.records.length, next.records.length) ||
    removesMost(current.documents.length, next.documents.length)
  );
}

export async function GET() {
  const session = await requireSession();
  if (isResponse(session)) return session;
  try {
    return ok(await readWorkspace());
  } catch (error) {
    return serverError("workspace read", error);
  }
}

// Whole-document compare-and-swap: body must be exactly {workspace, revision}.
export async function PUT(request: Request) {
  const session = await requireSession();
  if (isResponse(session)) return session;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail("Shared workspace is too large to save.", 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("Request body must be JSON.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Request body must be an object.", 422);
  const keys = Object.keys(body).sort().join(",");
  const { workspace, revision } = body as { workspace: unknown; revision: unknown };
  if (keys !== "revision,workspace" || !Number.isSafeInteger(revision) || (revision as number) < 0) {
    return fail("Send exactly {workspace, revision} with a non-negative integer revision.", 422);
  }

  let next;
  try {
    next = validateWorkspace(workspace);
  } catch (error) {
    if (error instanceof SenerValidationError) return fail(error.message, 422);
    return serverError("workspace validate", error);
  }

  try {
    const current = await readWorkspace();
    if (current.revision !== revision) {
      return fail(new RevisionConflict(current.revision).message, 409);
    }
    if (isMassRemoval(current.workspace, next) && !session.isAdmin) {
      return fail("Removing most of the shared SENER data at once requires an administrator.", 403);
    }
    return ok(await replaceWorkspace(next, revision as number, session.email));
  } catch (error) {
    if (error instanceof RevisionConflict) return fail(error.message, 409);
    return serverError("workspace write", error);
  }
}
