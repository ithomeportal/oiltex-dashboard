import { cookies } from "next/headers";
import pool from "@/lib/db";
import { isSuperAdmin, scopeForEmail, type AccessScope } from "@/lib/access";

export const SESSION_COOKIE = "session_token";

export interface Session {
  email: string;
  isAdmin: boolean;
  scope: AccessScope;
}

/**
 * Resolve a session token to the signed-in user, or null.
 *
 * Scope is derived from the email domain on every request (not stored), so
 * removing a domain from src/lib/access.ts revokes its live sessions at once.
 */
export async function sessionFromToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const result = await pool.query<{ email: string }>(
    `SELECT email FROM sessions WHERE token = $1 AND expires_at > NOW()`,
    [token]
  );
  const email = result.rows[0]?.email;
  if (!email) return null;
  const scope = scopeForEmail(email);
  if (!scope) return null;
  return { email, isAdmin: isSuperAdmin(email), scope };
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  return sessionFromToken(cookieStore.get(SESSION_COOKIE)?.value);
}
