import { isResponse, ok, requireSession, serverError } from "@/lib/sener/api";
import { readHistory } from "@/lib/sener/workspace-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireSession();
  if (isResponse(session)) return session;
  try {
    return ok(await readHistory());
  } catch (error) {
    return serverError("history read", error);
  }
}
