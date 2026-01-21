import { NextResponse } from "next/server";
import { Resend } from "resend";
import pool from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY);

// Allowed email domains for login
const ALLOWED_DOMAINS = [
  "oiltex.com",
  "unilinktransportation.com",
  "unilinkportal.com",
];

function generateCode(): string {
  // Generate 8-digit numeric code
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function isAllowedDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_DOMAINS.includes(domain);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }

    // Check if email domain is allowed
    if (!isAllowedDomain(email)) {
      return NextResponse.json(
        { success: false, error: "Access restricted to authorized domains only" },
        { status: 403 }
      );
    }

    // Generate 8-digit code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save code to database
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO auth_codes (email, code, expires_at)
         VALUES ($1, $2, $3)`,
        [email, code, expiresAt]
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
