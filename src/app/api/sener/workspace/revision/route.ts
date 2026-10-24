import { isResponse, ok, requireSession, serverError } from "@/lib/sener/api";
import { readRevision } from "@/lib/sener/workspace-db";

export const dynamic = "force-dynamic";

// Cheap poll target: clients refetch the full workspace only when this changes.
export async function GET() {
  const session = await requireSession();
  if (isResponse(session)) return session;
  try {
    return ok(await readRevision());
  } catch (error) {
    return serverError("revision read", error);
  }
}
