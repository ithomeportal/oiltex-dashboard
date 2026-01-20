import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: "Email and code are required" },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      // Check if code is valid and not expired
      const result = await client.query(
        `SELECT id FROM auth_codes
         WHERE email = $1
           AND code = $2
           AND expires_at > NOW()
           AND used = FALSE
         ORDER BY created_at DESC
         LIMIT 1`,
        [email, code]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired code" },
          { status: 401 }
        );
      }

      // Mark code as used
      await client.query(`UPDATE auth_codes SET used = TRUE WHERE id = $1`, [
        result.rows[0].id,
      ]);

      // Create session token
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await client.query(
        `INSERT INTO sessions (email, token, expires_at)
         VALUES ($1, $2, $3)`,
        [email, token, expiresAt]
      );

      // Create response with cookie
      const response = NextResponse.json({
        success: true,
        message: "Authentication successful",
        email,
      });

      response.cookies.set("session_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
      });

      return response;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error verifying code:", error);
    return NextResponse.json(
      { success: false, error: "Verification failed" },
      { status: 500 }
    );
  }
}
