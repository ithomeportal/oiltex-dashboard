import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import pool from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({
      authenticated: true,
      email: session.email,
      isAdmin: session.isAdmin,
      scope: session.scope,
    });
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
