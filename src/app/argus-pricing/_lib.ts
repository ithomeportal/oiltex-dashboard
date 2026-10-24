// Shared types, constants and helpers for the Argus Pricing page.
import { DASH } from "@/lib/format";

export interface ArgusPricingRow {
  id: number;
  report_date: string;
  contract_month: string;
  nymex_cma_td: number | null;
  cma_diff_low: number | null;
  cma_diff_high: number | null;
  cma_diff_daily: number | null;
  cma_diff_mtd: number | null;
  midland_diff_low: number | null;
  midland_diff_high: number | null;
  midland_diff_daily: number | null;
  midland_diff_mtd: number | null;
  wti_midland_price_low: number | null;
  wti_midland_price_high: number | null;
  wti_midland_price: number | null;
  est_net_daily: number | null;
  est_net_mtd: number | null;
  wtl_midland_diff_low: number | null;
  wtl_midland_diff_high: number | null;
  wtl_midland_diff: number | null;
  wtl_midland_low: number | null;
  wtl_midland_high: number | null;
  wtl_midland_wtd_avg: number | null;
  extraction_confidence: number | null;
}

export interface ProfitData {
  delivery_month: string;
  nymex_cma: number | null;
  fixed_deduction: number;
  marathon: {
    period: { start: string; end: string };
    cma_diff_avg: number | null;
    wti_midland_diff_avg: number | null;
    trading_days: number;
    sell_price: number | null;
  };
  devon: {
    period: { start: string; end: string };
    cma_diff_avg: number | null;
    wti_midland_diff_avg: number | null;
    trading_days: number;
    buy_price_before_transport: number | null;
  };
  net_delta_before_transport: number | null;
  volume: {
    ticket_count: number;
    delivered_bbls: number;
    net_barrels: number;
    shrinkage: number;
  };
  freight: {
    order_count: number;
    total_cost: number;
    freight_only: number;
    other_charges: number;
    carrier_pay: number;
    cost_per_bbl: number | null;
  };
}

export interface PricingApiResponse {
  success: boolean;
  data: {
    rows: ArgusPricingRow[];
    latest: ArgusPricingRow | null;
    months: string[];
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string;
}

export type LeaseBase = "WTI" | "WTL";

export interface Lease {
  readonly name: string;
  readonly county: string;
  readonly diff: number;
  readonly base: LeaseBase;
}

export const LEASE_DIFFERENTIALS = [
  { name: "BELLATRIX 28 FEDERAL", county: "Eddy County, NM", diff: 2.18, base: "WTI" as const },
  { name: "BFDU 52H/56H", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
  { name: "BFDU 61H", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
  { name: "GREEN WAVE 20 CTB 1", county: "Lea County, NM", diff: 2.26, base: "WTL" as const },
  { name: "LAGUNA SALADO 22 FEDERAL C", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
  { name: "SAND 7 FED OIL", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
] as const;

/** Same semantics as the page's original helper (kept local so calculations are unchanged). */
export function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return isNaN(n) ? null : n;
}

export function formatPrice(value: unknown, decimals: number = 2): string {
  const n = toNum(value);
  if (n === null) return DASH;
  return n.toFixed(decimals);
}

/** "$12.34" or a dash. */
export function formatDollar(value: unknown, decimals: number = 2): string {
  const s = formatPrice(value, decimals);
  return s === DASH ? DASH : `$${s}`;
}

export function formatDiff(value: unknown): string {
  const n = toNum(value);
  if (n === null) return DASH;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(4)}`;
}

export function formatMonthName(month: string): string {
  const [year, m] = month.split("-");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[parseInt(m, 10) - 1]} ${year}`;
}

/** 1234.5 → "1,234.50" */
export function fmtThousands(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function getDefaultContractMonth(): string {
  // Contract month is always current month + 1 (Argus reports in month M price delivery month M+1)
  const now = new Date();
  now.setMonth(now.getMonth() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Est Net after lease diff: WTL leases use WTL Midland Wtd Avg, WTI leases the given est-net value. */
export function netAfterLease(
  row: Pick<ArgusPricingRow, "wtl_midland_wtd_avg"> | null | undefined,
  wtiValue: unknown,
  isWtlLease: boolean,
  transport: number,
): number | null {
  if (isWtlLease) {
    const wtl = toNum(row?.wtl_midland_wtd_avg);
    return wtl !== null ? wtl - transport : null;
  }
  const n = toNum(wtiValue);
  return n !== null ? n - transport : null;
}

// ---- CSV export (output must stay byte-identical) ---------------------------

// Shared CSV builder for one month of data
export function buildCsvRows(rows: ArgusPricingRow[]): string[] {
  // Sort rows by date ascending for change calculation (API returns DESC)
  const sorted = [...rows].sort(
    (a, b) => a.report_date.localeCompare(b.report_date)
  );

  const fmtTiming = (cm: string) => {
    const [y, m] = cm.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m, 10) - 1]}-${y}`;
  };

  const v = (n: number | null | undefined) => n ?? "";
  const chg = (a: number | null | undefined, b: number | null | undefined) =>
    a != null && b != null ? parseFloat((a - b).toFixed(4)) : "";

  const dataRows: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;
    const timing = fmtTiming(row.contract_month);
    const date = row.report_date.split("T")[0];

    const cmaDiff = parseFloat(String(row.cma_diff_daily)) || null;
    const prevCmaDiff = prev ? (parseFloat(String(prev.cma_diff_daily)) || null) : null;
    const midDiff = parseFloat(String(row.midland_diff_daily)) || null;
    const prevMidDiff = prev ? (parseFloat(String(prev.midland_diff_daily)) || null) : null;
    const midPrice = parseFloat(String(row.wti_midland_price)) || null;
    const prevMidPrice = prev ? (parseFloat(String(prev.wti_midland_price)) || null) : null;
    const wtlDiff = parseFloat(String(row.wtl_midland_diff)) || null;
    const prevWtlDiff = prev ? (parseFloat(String(prev.wtl_midland_diff)) || null) : null;
    const wtlPrice = parseFloat(String(row.wtl_midland_wtd_avg)) || null;
    const prevWtlPrice = prev ? (parseFloat(String(prev.wtl_midland_wtd_avg)) || null) : null;

    dataRows.push([
      date,
      // WTI CMA Diff
      timing, v(row.cma_diff_low), v(row.cma_diff_high), v(row.cma_diff_daily), chg(cmaDiff, prevCmaDiff),
      // WTI Midland
      timing, v(row.midland_diff_low), v(row.midland_diff_high), v(row.midland_diff_daily),
      v(row.wti_midland_price_low), v(row.wti_midland_price_high), v(row.wti_midland_price),
      chg(midPrice, prevMidPrice), chg(midDiff, prevMidDiff),
      // WTL Midland
      timing, v(row.wtl_midland_diff_low), v(row.wtl_midland_diff_high), v(row.wtl_midland_diff),
      v(row.wtl_midland_low), v(row.wtl_midland_high), v(row.wtl_midland_wtd_avg),
      chg(wtlPrice, prevWtlPrice), chg(wtlDiff, prevWtlDiff),
      // Extra columns (beyond Excel format)
      v(row.nymex_cma_td), v(row.cma_diff_mtd), v(row.midland_diff_mtd),
      v(row.est_net_daily), v(row.est_net_mtd),
    ].join(","));
  }
  // Return in reverse (most recent first)
  return dataRows.reverse();
}

export function csvHeaders(): string[] {
  const headerRow1 = [
    "",
    "WTI Diff to CMA Nymex month 1 USD/bl", "", "", "", "",
    "WTI Midland month 1 USD/bl", "", "", "", "", "", "", "", "",
    "WTL Midland month 1 USD/bl", "", "", "", "", "", "", "", "",
    "Extended Data", "", "", "", "",
  ];
  const headerRow2 = [
    "Date",
    "Timing", "Diff Low", "Diff High", "Diff", "Diff. Change",
    "Timing", "Diff Low", "Diff High", "Diff", "Price Low", "Price High", "Price", "Change", "Diff. Change",
    "Timing", "Diff Low", "Diff High", "Diff", "Price Low", "Price High", "Price", "Change", "Diff. Change",
    "NYMEX CMA TD", "CMA Diff MTD", "Midland Diff MTD", "Est Net Daily", "Est Net MTD",
  ];
  return [headerRow1.join(","), headerRow2.join(",")];
}

export function triggerDownload(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
