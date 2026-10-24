// Shared display formatters. Precision conventions (see CLAUDE.md):
// prices 2dp, differentials 4dp, volumes 2dp, gravity 1dp, dollars 2dp.

export const DASH = "—";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** pg returns DECIMAL as string — normalise anything numeric-ish to a number or null. */
export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function fmtNum(value: unknown, decimals = 2): string {
  const n = toNum(value);
  if (n === null) return DASH;
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtMoney(value: unknown, decimals = 2): string {
  const n = toNum(value);
  if (n === null) return DASH;
  const body = fmtNum(Math.abs(n), decimals);
  return n < 0 ? `-$${body}` : `$${body}`;
}

/** Always-signed number, e.g. differentials "+0.1234" or "-$1.20". */
export function fmtSigned(value: unknown, decimals = 2, prefix = ""): string {
  const n = toNum(value);
  if (n === null) return DASH;
  return `${n < 0 ? "-" : "+"}${prefix}${fmtNum(Math.abs(n), decimals)}`;
}

export function fmtPct(value: unknown, decimals = 1): string {
  const signed = fmtSigned(value, decimals);
  return signed === DASH ? DASH : `${signed}%`;
}

export function fmtBbls(value: unknown, decimals = 2): string {
  return fmtNum(value, decimals);
}

/** "2026-02-04 Wed" — ISO date first, weekday after (user preference). UTC-safe. */
export function fmtDayDate(value: string | Date | null | undefined): string {
  if (!value) return DASH;
  const iso = value instanceof Date ? value.toISOString() : value;
  const day = iso.slice(0, 10);
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return DASH;
  return `${day} ${WEEKDAYS[d.getUTCDay()]}`;
}
