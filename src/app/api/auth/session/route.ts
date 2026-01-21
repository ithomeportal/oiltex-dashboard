import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/lib/db";

// Superadmin emails - these users have elevated privileges
const SUPERADMIN_EMAILS = [
  "ithome@unilinkportal.com",
];

function isSuperAdmin(email: string): boolean {
  return SUPERADMIN_EMAILS.includes(email.toLowerCase());
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT email FROM sessions
         WHERE token = $1 AND expires_at > NOW()`,
        [token]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ authenticated: false });
      }

      const email = result.rows[0].email;
      return NextResponse.json({
        authenticated: true,
        email: email,
        isAdmin: isSuperAdmin(email),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}

// Logout - DELETE session
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (token) {
      const client = await pool.connect();
      try {
        await client.query(`DELETE FROM sessions WHERE token = $1`, [token]);
      } finally {
        client.release();
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("session_token");
    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Logout failed" },
      { status: 500 }
    );
  }
}
