import { NextResponse } from "next/server";
import { getSession, type Session } from "@/lib/session";

// Small helpers shared by the /api/sener routes: one response envelope and one
// session check. src/proxy.ts already rejects requests without a session; the
// routes check again so they stay safe if the proxy matcher ever changes.

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data, error: null }, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(error: string, status: number) {
  return NextResponse.json({ success: false, data: null, error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function requireSession(): Promise<Session | NextResponse> {
  const session = await getSession();
  return session ?? fail("Authentication required", 401);
}

export function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

/** Log the detail server-side; return a generic message to the client. */
export function serverError(context: string, error: unknown) {
  console.error(`sener ${context}:`, error);
  return fail("The SENER service is temporarily unavailable. Please retry.", 503);
}
