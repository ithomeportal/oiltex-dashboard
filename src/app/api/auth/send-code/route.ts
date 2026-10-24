import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import pool from "@/lib/db";
import { emailDomain, scopeForEmail } from "@/lib/access";

const resend = new Resend(process.env.RESEND_API_KEY);

const MAX_CODES_PER_WINDOW = 3;

function generateCode(): string {
  // 8-digit numeric code from a CSPRNG
  return randomInt(10000000, 100000000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email: rawEmail } = body;

    if (!rawEmail || !rawEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Normalize email: lowercase and trim whitespace
    const email = rawEmail.toLowerCase().trim();

    // Domain policy (company tenant + named external SENER exemption): src/lib/access.ts
    if (!scopeForEmail(email)) {
      console.warn(`send-code: rejected domain ${emailDomain(email) || "(none)"}`);
      return NextResponse.json(
        { success: false, error: "Access restricted to authorized domains only" },
        { status: 403 }
      );
    }

    // Generate 8-digit code
    const code = generateCode();

    // Save code to database — use DB's NOW() + interval for consistent timestamps
    const client = await pool.connect();
    try {
      // Throttle: unauthenticated endpoint that sends mail — cap codes per address.
      const recent = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM auth_codes
          WHERE email = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
        [email]
      );
      if (recent.rows[0].n >= MAX_CODES_PER_WINDOW) {
        return NextResponse.json(
          { success: false, error: "Too many codes requested. Please wait 10 minutes and try again." },
          { status: 429 }
        );
      }
      await client.query(
        `INSERT INTO auth_codes (email, code, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
        [email, code]
      );
    } finally {
      client.release();
    }

    // Send email via Resend
    const { data, error: resendError } = await resend.emails.send({
      from: "OilTex Dashboard <noreply@unilinkportal.com>",
      to: email,
      subject: "Your OilTex Dashboard Login Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">OilTex Price Dashboard</h2>
          <p>Your login verification code is:</p>
          <div style="background: #f0f4f8; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #2d3748;">
              ${code}
            </span>
          </div>
          <p style="color: #718096;">This code expires in 10 minutes.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="color: #a0aec0; font-size: 12px;">
            If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    if (resendError) {
      console.error("Resend error:", resendError);
      return NextResponse.json(
        { success: false, error: "Failed to send email", details: resendError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email",
      emailId: data?.id,
    });
  } catch (error) {
    console.error("Error sending auth code:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: "Failed to send verification code", details: errorMessage },
      { status: 500 }
    );
  }
}
