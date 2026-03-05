"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";

interface ArgusPricingRow {
  id: number;
  report_date: string;
  contract_month: string;
  nymex_cma_td: number | null;
  cma_diff_daily: number | null;
  cma_diff_mtd: number | null;
  midland_diff_daily: number | null;
  midland_diff_mtd: number | null;
  est_net_daily: number | null;
  est_net_mtd: number | null;
  wtl_midland_low: number | null;
  wtl_midland_high: number | null;
  wtl_midland_wtd_avg: number | null;
  extraction_confidence: number | null;
}

interface PricingApiResponse {
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

function formatDate(dateStr: string): string {
  const dateOnly = dateStr.split("T")[0];
  const date = new Date(dateOnly + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return isNaN(n) ? null : n;
}

function formatPrice(value: unknown, decimals: number = 2): string {
  const n = toNum(value);
  if (n === null) return "--";
  return n.toFixed(decimals);
}

function formatMonthName(month: string): string {
  const [year, m] = month.split("-");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[parseInt(m, 10) - 1]} ${year}`;
}

function formatDiff(value: unknown): string {
  const n = toNum(value);
  if (n === null) return "--";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(4)}`;
}

const LEASE_DIFFERENTIALS = [
  { name: "BELLATRIX 28 FEDERAL", county: "Eddy County, NM", diff: 2.18, base: "WTI" as const },
  { name: "BFDU 52H/56H", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
  { name: "BFDU 61H", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
  { name: "GREEN WAVE 20 CTB 1", county: "Lea County, NM", diff: 2.26, base: "WTL" as const },
  { name: "LAGUNA SALADO 22 FEDERAL", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
  { name: "SAND 7 FED OIL", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
] as const;

function getDefaultContractMonth(): string {
  // Default to current month; will be overridden once we fetch available months
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ArgusPricingPage() {
  const [data, setData] = useState<PricingApiResponse["data"] | null>(null);
  const [meta, setMeta] = useState<PricingApiResponse["meta"] | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultContractMonth());
  const [selectedLease, setSelectedLease] = useState("BFDU 52H/56H");
  const [transportCost, setTransportCost] = useState("2.26");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeLease = LEASE_DIFFERENTIALS.find((l) => l.name === selectedLease) || LEASE_DIFFERENTIALS[1];

  const fetchData = useCallback(
    async (month: string, p: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/argus-pricing?month=${month}&page=${p}&limit=31`
        );
        const json: PricingApiResponse = await res.json();
        if (!json.success) {
          setError(json.error || "Failed to load pricing data");
          return;
        }
        setData(json.data);
        setMeta(json.meta);
        // If we got months back and selected month isn't in the list, switch to first available
        if (
          json.data.months.length > 0 &&
          !json.data.months.includes(month)
        ) {
          setSelectedMonth(json.data.months[0]);
        }
      } catch {
        setError("Failed to load pricing data");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(selectedMonth, page);
  }, [selectedMonth, page, fetchData]);

  const latest = data?.latest;
  const transport = parseFloat(transportCost) || 0;
  const isWtlLease = activeLease.base === "WTL";

  // For WTI leases: Est Net = CMA TD + CMA Diff + Midland Diff - Lease Diff
  // For WTL leases: Est Net = WTL Midland Wtd Avg - Lease Diff
  const latestEstNetMtd = toNum(latest?.est_net_mtd);
  const latestWtlMidland = toNum(latest?.wtl_midland_wtd_avg);
  const estNetMtdMinusTransport = isWtlLease
    ? latestWtlMidland !== null ? latestWtlMidland - transport : null
    : latestEstNetMtd !== null ? latestEstNetMtd - transport : null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Argus Pricing</h1>
            <p className="text-slate-400 mt-1">
              Extracted from Argus Americas Crude daily reports
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Month Selector */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Contract Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm"
              >
                {data?.months && data.months.length > 0 ? (
                  data.months.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthName(m)}
                    </option>
                  ))
                ) : (
                  <option value={selectedMonth}>{formatMonthName(selectedMonth)}</option>
                )}
              </select>
            </div>
            {/* Lease Selector */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Lease
              </label>
              <select
                value={selectedLease}
                onChange={(e) => {
                  setSelectedLease(e.target.value);
                  const lease = LEASE_DIFFERENTIALS.find((l) => l.name === e.target.value);
                  if (lease) setTransportCost(lease.diff.toFixed(2));
                }}
                className="bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm"
              >
                {LEASE_DIFFERENTIALS.map((l) => (
                  <option key={l.name} value={l.name}>
                    {l.name} ({l.base})
                  </option>
                ))}
              </select>
            </div>
            {/* Lease Diff Override */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Lease Diff ($/bbl)
              </label>
              <input
                type="number"
                step="0.01"
                value={transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
                className="bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm w-24"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {/* NYMEX CMA TD */}
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-sm p-5 text-white">
            <div className="text-sm text-amber-100 mb-1">NYMEX CMA TD</div>
            <div className="text-3xl font-bold">
              ${formatPrice(latest?.nymex_cma_td)}
            </div>
            <div className="text-xs text-amber-200 mt-2">
              Running avg settlement
            </div>
          </div>

          {/* CMA Diff MTD */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">CMA Diff MTD</div>
            <div className="text-3xl font-bold text-slate-800">
              {formatDiff(latest?.cma_diff_mtd)}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              WTI diff to CMA Nymex
            </div>
          </div>

          {/* Midland Diff MTD */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Midland Diff MTD</div>
            <div className="text-3xl font-bold text-green-600">
              {formatDiff(latest?.midland_diff_mtd)}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              WTL Midland vs WTI Cushing
            </div>
          </div>

          {/* WTL Midland Flat Price */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm p-5 text-white">
            <div className="text-sm text-emerald-100 mb-1">WTL Midland</div>
            <div className="text-3xl font-bold">
              ${formatPrice(latest?.wtl_midland_wtd_avg)}
            </div>
            <div className="text-xs text-emerald-200 mt-2">
              Wtd Avg (L: ${formatPrice(latest?.wtl_midland_low)} / H: ${formatPrice(latest?.wtl_midland_high)})
            </div>
          </div>

          {/* Argus Est Net Price */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-sm p-5 text-white">
            <div className="text-sm text-blue-100 mb-1">
              Est. Net — {activeLease.base}
            </div>
            <div className="text-3xl font-bold">
              ${estNetMtdMinusTransport !== null
                ? formatPrice(estNetMtdMinusTransport)
                : "--"}
            </div>
            <div className="text-xs text-blue-200 mt-2">
              {isWtlLease ? "WTL Midland" : "CMA TD + Diffs"} - ${transport.toFixed(2)} lease diff
            </div>
          </div>
        </div>

        {/* Formula breakdown */}
        {latest && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-8">
            <div className="text-sm text-slate-400 mb-2">
              Pricing Formula — {activeLease.name} ({activeLease.base}) as of{" "}
              {latest.report_date
                ? formatDate(latest.report_date)
                : "latest"}
            </div>
            <div className="font-mono text-sm text-slate-300 flex flex-wrap gap-x-4">
              {isWtlLease ? (
                <>
                  <span>
                    WTL Midland Wtd Avg:{" "}
                    <span className="text-emerald-400">
                      ${formatPrice(latest.wtl_midland_wtd_avg)}
                    </span>
                  </span>
                  <span>
                    - Lease Diff:{" "}
                    <span className="text-red-400">${transport.toFixed(2)}</span>
                  </span>
                  <span className="font-bold">
                    ={" "}
                    <span className="text-blue-400">
                      $
                      {estNetMtdMinusTransport !== null
                        ? formatPrice(estNetMtdMinusTransport)
                        : "--"}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span>
                    NYMEX CMA TD:{" "}
                    <span className="text-amber-400">
                      ${formatPrice(latest.nymex_cma_td)}
                    </span>
                  </span>
                  <span>
                    + CMA Diff:{" "}
                    <span className="text-white">
                      {formatDiff(latest.cma_diff_mtd)}
                    </span>
                  </span>
                  <span>
                    + Midland Diff:{" "}
                    <span className="text-green-400">
                      {formatDiff(latest.midland_diff_mtd)}
                    </span>
                  </span>
                  <span>
                    - Lease Diff:{" "}
                    <span className="text-red-400">${transport.toFixed(2)}</span>
                  </span>
                  <span className="font-bold">
                    ={" "}
                    <span className="text-blue-400">
                      $
                      {estNetMtdMinusTransport !== null
                        ? formatPrice(estNetMtdMinusTransport)
                        : "--"}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Lease Differentials Reference */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-8">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-slate-300">Lease Transportation Differentials (Exhibit A)</h3>
            <p className="text-xs text-slate-500 mt-1">
              Includes Big Star Crude truck rate (one-way mileage) + $0.25 Marathon unloading + OilTex margin. All plus FSC.
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">Location</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-400">County</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-slate-400">Lease Diff</th>
                <th className="text-center px-4 py-2 text-xs font-medium text-slate-400">Base Price</th>
              </tr>
            </thead>
            <tbody>
              {LEASE_DIFFERENTIALS.map((lease) => (
                <tr
                  key={lease.name}
                  className={`border-b border-slate-700/50 transition-colors ${
                    lease.name === selectedLease
                      ? "bg-blue-500/10"
                      : "hover:bg-slate-700/30"
                  }`}
                >
                  <td className="px-4 py-2 text-sm text-white">
                    {lease.name}
                    {lease.name === selectedLease && (
                      <span className="ml-2 text-xs text-blue-400">selected</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-400">{lease.county}</td>
                  <td className="px-4 py-2 text-sm text-right text-red-400 font-mono">
                    -${lease.diff.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-sm text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      lease.base === "WTL"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}>
                      {lease.base}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Daily Table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">
                  Date
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  NYMEX CMA
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  CMA Diff Daily
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  CMA Diff MTD
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  Midland Daily
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  Midland MTD
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  WTL Midland
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  Est Net Daily
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  Est Net MTD
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  Conf
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : !data?.rows || data.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    No pricing data for {selectedMonth}. Run backfill extraction
                    to populate.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => {
                  const rowWtlMidland = toNum(row.wtl_midland_wtd_avg);
                  const rowEstNetDailyNum = toNum(row.est_net_daily);
                  const rowEstNetDaily = isWtlLease
                    ? rowWtlMidland !== null ? rowWtlMidland - transport : null
                    : rowEstNetDailyNum !== null ? rowEstNetDailyNum - transport : null;
                  const rowEstNetMtdNum = toNum(row.est_net_mtd);
                  const rowEstNetMtd = isWtlLease
                    ? rowWtlMidland !== null ? rowWtlMidland - transport : null
                    : rowEstNetMtdNum !== null ? rowEstNetMtdNum - transport : null;

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        {formatDate(row.report_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-amber-400">
                        ${formatPrice(row.nymex_cma_td)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-300">
                        {formatDiff(row.cma_diff_daily)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-300">
                        {formatDiff(row.cma_diff_mtd)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-300">
                        {formatDiff(row.midland_diff_daily)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-green-400">
                        {formatDiff(row.midland_diff_mtd)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-emerald-400">
                        ${formatPrice(row.wtl_midland_wtd_avg)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-300">
                        ${formatPrice(rowEstNetDaily)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-blue-400">
                        ${formatPrice(rowEstNetMtd)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-slate-500">
                        {row.extraction_confidence ?? "--"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <p className="text-sm text-slate-400">
                Showing {(meta.page - 1) * meta.limit + 1}–
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-400">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage((p) => Math.min(meta.totalPages, p + 1))
                  }
                  disabled={page === meta.totalPages}
                  className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
