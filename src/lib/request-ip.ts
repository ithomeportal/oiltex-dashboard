/**
 * Client IP for rate limiting. On Vercel `x-forwarded-for` is set by the edge
 * (first entry = the real client) and cannot be spoofed past it; elsewhere it
 * is best-effort. Returns null when unknown — callers must then skip the
 * per-IP limit rather than lump every unknown client into one bucket.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "";
  return ip ? ip.slice(0, 64) : null;
}
