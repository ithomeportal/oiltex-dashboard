import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isSenerPath } from "@/lib/access";
import { SESSION_COOKIE, sessionFromToken } from "@/lib/session";

/**
 * Server-side access gate (Next 16 proxy — Node runtime, so it can reach the DB).
 *
 * Before 2026-10-24 every data API was reachable without a session; pages only
 * redirected in the browser. Now:
 *   - no session          → pages redirect to /login, APIs answer 401
 *   - SENER-scoped session (external counsel, see src/lib/access.ts)
 *                         → only /sener pages and SENER APIs; others redirect / 403
 *
 * Exempt: the login flow itself, static files OUTSIDE /api, CRON_SECRET bearer
 * calls (Vercel crons + admin scripts), and the UploadThing callback (signed by
 * UploadThing; each uploader checks the session itself). /api/cron/* is never
 * exempt by path: without a valid bearer it is rejected here.
 *
 * ⚠ Never skip by file extension on /api — `/api/x/5.png` still routes to
 * `/api/x/[id]` (parseInt("5.png") === 5). That bypass shipped in an earlier
 * draft of this file and was caught in review.
 */
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/send-code",
  "/api/auth/verify-code",
  "/api/auth/session",
  "/api/uploadthing",
]);

const STATIC_FILE_RE = /\.(?:png|svg|jpg|jpeg|webp|ico|txt)$/;

function hasCronBearer(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function isExempt(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (!pathname.startsWith("/api/") && STATIC_FILE_RE.test(pathname)) return true;
  return hasCronBearer(request);
}

function deny(request: NextRequest, status: 401 | 403, redirectTo: string) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const error = status === 401 ? "Authentication required" : "Not available for this account";
    return NextResponse.json({ success: false, data: null, error }, { status });
  }
  return NextResponse.redirect(new URL(redirectTo, request.url));
}

export async function proxy(request: NextRequest) {
  if (isExempt(request)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/cron/")) {
    return NextResponse.json({ success: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  let session;
  try {
    session = await sessionFromToken(request.cookies.get(SESSION_COOKIE)?.value);
  } catch (error) {
    console.error("proxy: session lookup failed", error);
    return NextResponse.json(
      { success: false, data: null, error: "Session service unavailable" },
      { status: 503 }
    );
  }

  if (!session) return deny(request, 401, "/login");
  if (session.scope === "sener" && !isSenerPath(request.nextUrl.pathname)) {
    return deny(request, 403, "/sener");
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next build assets; static-file skipping happens in
  // isExempt() so it can never apply to /api routes.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
