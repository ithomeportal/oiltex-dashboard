/**
 * Who may sign in, and what they may see.
 *
 * Company email domains — the Microsoft 365 tenant's verified domains
 * (Graph `GET /domains`). Widened from 3 to 16 on 2026-07-30 so staff on the
 * other tenant domains can sign in. Override with ALLOWED_EMAIL_DOMAINS.
 *
 * The login OTP is the only recipient-bearing mail this app sends, and the
 * domain check runs before both the DB insert and the Resend call — so it is
 * the send guard as well as the login gate.
 */
export const ORG_EMAIL_DOMAINS = [
  "hireinternational.com",
  "itunilink.com",
  "mencarllc.com",
  "mencarotr.com",
  "mspekt.com",
  "oiltex.com",
  "otxtransport.com",
  "otxtransportation.com",
  "prosperityenergyresources.com",
  "seekequipment.com",
  "u-capital.com",
  "unilinkcapital.com",
  "unilinkportal.com",
  "unilinktransportation.com",
  "unilinktransportationsa.mail.onmicrosoft.com",
  "unilinktransportationsa.onmicrosoft.com",
];

/**
 * SANCTIONED EXTERNAL EXEMPTION (fleet email-domain policy, 2026-10-24).
 *
 * Outside parties who work on the SENER import permits and must receive login
 * codes. They are NOT company staff: their sessions are scoped to the SENER
 * feature only — every other page redirects and every other API returns 403
 * (enforced in src/proxy.ts, not just hidden in the sidebar).
 *
 * - nhq.com.mx — Nader Hayaux Goebel, OilTex's Mexican legal counsel
 *   (Diana Pineda and her team).
 */
export const SENER_EXTERNAL_DOMAINS = ["nhq.com.mx"];

export const SUPERADMIN_EMAILS = ["ithome@unilinkportal.com"];

export type AccessScope = "internal" | "sener";

const ORG_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS?.trim()
  ? process.env.ALLOWED_EMAIL_DOMAINS.split(",")
      .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean)
  : ORG_EMAIL_DOMAINS;

export function emailDomain(email: string): string {
  return email.split("@")[1]?.trim().toLowerCase() ?? "";
}

/** null = may not sign in at all. */
export function scopeForEmail(email: string): AccessScope | null {
  const domain = emailDomain(email);
  if (!domain) return null;
  if (ORG_DOMAINS.includes(domain)) return "internal";
  if (SENER_EXTERNAL_DOMAINS.includes(domain)) return "sener";
  return null;
}

export function isSuperAdmin(email: string): boolean {
  return SUPERADMIN_EMAILS.includes(email.toLowerCase());
}

/** Paths a SENER-scoped (external) session may reach. Everything else is internal. */
export function isSenerPath(pathname: string): boolean {
  return (
    pathname === "/sener" ||
    pathname.startsWith("/sener/") ||
    pathname.startsWith("/api/sener/") ||
    pathname === "/api/uploadthing" ||
    pathname.startsWith("/api/auth/")
  );
}
