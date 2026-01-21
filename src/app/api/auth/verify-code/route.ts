import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email: rawEmail, code } = body;

    if (!rawEmail || !code) {
      return NextResponse.json(
        { success: false, error: "Email and code are required" },
        { status: 400 }
      );
    }

    // Normalize email: lowercase and trim whitespace (must match send-code normalization)
    const email = rawEmail.toLowerCase().trim();
    // Normalize code: trim whitespace
    const normalizedCode = code.toString().trim();

    // Get current UTC time for comparison
    const nowUtc = new Date().toISOString();

    const client = await pool.connect();
    try {
      // Check if code is valid and not expired
      // Compare timestamps in UTC to avoid timezone issues
      const result = await client.query(
        `SELECT id FROM auth_codes
         WHERE email = $1
           AND code = $2
           AND expires_at > $3::timestamptz
           AND used = FALSE
         ORDER BY created_at DESC
         LIMIT 1`,
        [email, normalizedCode, nowUtc]
      );

      if (result.rows.length === 0) {
        // Log debug info for troubleshooting
        const debugResult = await client.query(
          `SELECT id, email, code, expires_at, used,
                  $2::timestamptz as current_time,
                  expires_at > $2::timestamptz as is_not_expired
           FROM auth_codes
           WHERE email = $1
           ORDER BY created_at DESC
           LIMIT 3`,
          [email, nowUtc]
        );
        console.log("Code verification failed. Debug info:", {
          providedEmail: email,
          providedCode: normalizedCode,
          currentUtcTime: nowUtc,
          recentCodes: debugResult.rows.map(r => ({
            id: r.id,
            storedCode: r.code,
            codeMatch: r.code === normalizedCode,
            expiresAt: r.expires_at,
            currentTime: r.current_time,
            isNotExpired: r.is_not_expired,
            used: r.used
          }))
        });

        return NextResponse.json(
          { success: false, error: "Invalid or expired code" },
          { status: 401 }
        );
      }

      // Use transaction to ensure atomicity - don't mark code as used until session is created
      await client.query('BEGIN');

      let token: string;
      let expiresAt: Date;

      try {
        // Create session token first
        token = generateToken();
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await client.query(
          `INSERT INTO sessions (email, token, expires_at)
           VALUES ($1, $2, $3)`,
          [email, token, expiresAt]
        );

        // Mark code as used only after session is created successfully
        await client.query(`UPDATE auth_codes SET used = TRUE WHERE id = $1`, [
          result.rows[0].id,
        ]);

        await client.query('COMMIT');
      } catch (txError) {
        await client.query('ROLLBACK');
        const txErrorMsg = txError instanceof Error ? txError.message : String(txError);
        console.error("Transaction failed:", txErrorMsg, txError);
        throw new Error(`Session creation failed: ${txErrorMsg}`);
      }

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: "Verification failed", details: errorMessage },
      { status: 500 }
    );
  }
}
