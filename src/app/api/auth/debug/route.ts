import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
        id,
        email,
        code,
        expires_at,
        expires_at AT TIME ZONE 'UTC' as expires_at_utc,
        used,
        created_at,
        NOW() as db_now,
        NOW() AT TIME ZONE 'UTC' as db_now_utc,
        expires_at > NOW() as is_valid
       FROM auth_codes
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [email]
    );

    return NextResponse.json({
      serverTime: new Date().toISOString(),
      email,
      codes: result.rows
    });
  } finally {
    client.release();
  }
}
