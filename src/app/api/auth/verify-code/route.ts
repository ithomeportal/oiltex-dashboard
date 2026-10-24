import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { randomBytes } from "crypto";
import { scopeForEmail } from "@/lib/access";

const MAX_FAILED_ATTEMPTS = 5;

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

    if (!scopeForEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Access restricted to authorized domains only" },
        { status: 403 }
      );
    }

    // One transaction with the email's live codes row-locked (FOR UPDATE), so
    // parallel guesses serialize: each miss is counted before the next request
    // can read the codes, and after MAX_FAILED_ATTEMPTS they are all burned.
    // DB NOW() avoids Vercel↔DB clock skew. Never log codes or the address.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let token: string;
      let expiresAt: Date;
      try {
        const live = await client.query<{ id: string; code: string }>(
          `SELECT id, code FROM auth_codes
            WHERE email = $1 AND used = FALSE AND expires_at > NOW()
            ORDER BY created_at DESC
            FOR UPDATE`,
          [email]
        );
        const hit = live.rows.find((row) => row.code === normalizedCode);

        if (!hit) {
          if (live.rows.length > 0) {
            await client.query(
              `UPDATE auth_codes
                  SET failed_attempts = failed_attempts + 1,
                      used = (failed_attempts + 1 >= $2)
                WHERE id::text = ANY($1::text[])`,
              [live.rows.map((row) => row.id), MAX_FAILED_ATTEMPTS]
            );
          }
          await client.query("COMMIT");
          return NextResponse.json(
            { success: false, error: "Invalid or expired code" },
            { status: 401 }
          );
        }

        token = generateToken();
        expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        await client.query(
          `INSERT INTO sessions (email, token, expires_at) VALUES ($1, $2, $3)`,
          [email, token, expiresAt]
        );
        await client.query(`UPDATE auth_codes SET used = TRUE WHERE id = $1`, [hit.id]);
        await client.query("COMMIT");
      } catch (txError) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw txError;
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
    return NextResponse.json(
      { success: false, error: "Verification failed" },
      { status: 500 }
    );
  }
}
