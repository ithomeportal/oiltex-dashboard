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

interface ProfitData {
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
  { name: "LAGUNA SALADO 22 FEDERAL C", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
  { name: "SAND 7 FED OIL", county: "Eddy County, NM", diff: 2.26, base: "WTI" as const },
] as const;

function getDefaultContractMonth(): string {
  // Contract month is always current month + 1 (Argus reports in month M price delivery month M+1)
  const now = new Date();
  now.setMonth(now.getMonth() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ArgusPricingPage() {
  const [data, setData] = useState<PricingApiResponse["data"] | null>(null);
  const [meta, setMeta] = useState<PricingApiResponse["meta"] | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultContractMonth());
  const [selectedLease, setSelectedLease] = useState("ALL");
  const [transportCost, setTransportCost] = useState("2.26");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profitData, setProfitData] = useState<ProfitData | null>(null);

  const activeLease = selectedLease === "ALL"
    ? { name: "ALL Leases", county: "", diff: 2.26, base: "WTI" as const }
    : LEASE_DIFFERENTIALS.find((l) => l.name === selectedLease) || LEASE_DIFFERENTIALS[1];

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

  const fetchProfit = useCallback(async (month: string) => {
    try {
      const res = await fetch(`/api/argus-pricing/profit?delivery_month=${month}`);
      const json = await res.json();
      if (json.success) {
        setProfitData(json.data);
      }
    } catch {
      // Profit data is supplementary, don't block on errors
    }
  }, []);

  useEffect(() => {
    fetchData(selectedMonth, page);
    fetchProfit(selectedMonth);
  }, [selectedMonth, page, fetchData, fetchProfit]);

  const downloadCsv = useCallback(async () => {
    if (!selectedMonth) return;
    try {
      const res = await fetch(`/api/argus-pricing?month=${selectedMonth}&page=1&limit=999`);
      const json: PricingApiResponse = await res.json();
      if (!json.success || !json.data.rows.length) return;

      const headers = [
        "Date", "NYMEX CMA TD", "CMA Diff Daily", "CMA Diff MTD",
        "Midland Diff Daily", "Midland Diff MTD", "Est Net Daily", "Est Net MTD",
        "WTL Midland Low", "WTL Midland High", "WTL Midland Wtd Avg", "Confidence"
      ];
      const csvRows = [headers.join(",")];
      for (const row of json.data.rows) {
        csvRows.push([
          row.report_date.split("T")[0],
          row.nymex_cma_td ?? "",
          row.cma_diff_daily ?? "",
          row.cma_diff_mtd ?? "",
          row.midland_diff_daily ?? "",
          row.midland_diff_mtd ?? "",
          row.est_net_daily ?? "",
          row.est_net_mtd ?? "",
          row.wtl_midland_low ?? "",
          row.wtl_midland_high ?? "",
          row.wtl_midland_wtd_avg ?? "",
          row.extraction_confidence ?? "",
        ].join(","));
      }
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `argus-pricing-${selectedMonth}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  }, [selectedMonth]);

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
            <h1 className="text-2xl font-bold text-slate-800">Argus Pricing</h1>
            <p className="text-slate-500 mt-1">
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
                  if (e.target.value === "ALL") {
                    setTransportCost("2.26");
                  } else {
                    const lease = LEASE_DIFFERENTIALS.find((l) => l.name === e.target.value);
                    if (lease) setTransportCost(lease.diff.toFixed(2));
                  }
                }}
                className="bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm"
              >
                <option value="ALL">ALL Leases</option>
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
            {/* CSV Export */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">&nbsp;</label>
              <button
                onClick={downloadCsv}
                disabled={!data?.rows?.length}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </button>
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
            <div className="text-sm text-amber-200 mt-2">
              Running avg settlement
            </div>
          </div>

          {/* CMA Diff MTD */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">CMA Diff MTD</div>
            <div className="text-3xl font-bold text-slate-800">
              {formatDiff(latest?.cma_diff_mtd)}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              WTI diff to CMA Nymex
            </div>
          </div>

          {/* Midland Diff MTD */}
          <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">Midland Diff MTD</div>
            <div className="text-3xl font-bold text-green-600">
              {formatDiff(latest?.midland_diff_mtd)}
            </div>
            <div className="text-sm text-slate-400 mt-2">
              WTL Midland vs WTI Cushing
            </div>
          </div>

          {/* WTL Midland Flat Price */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm p-5 text-white">
            <div className="text-sm text-emerald-100 mb-1">WTL Midland</div>
            <div className="text-3xl font-bold">
              ${formatPrice(latest?.wtl_midland_wtd_avg)}
            </div>
            <div className="text-sm text-emerald-200 mt-2">
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
            <div className="text-sm text-blue-200 mt-2">
              {isWtlLease ? "WTL Midland" : "CMA TD + Diffs"} - ${transport.toFixed(2)} lease diff
            </div>
          </div>
        </div>

        {/* Buy / Sell / Profit KPI Cards */}
        {profitData && (
          <div className="mb-8">
            <div className="text-sm text-slate-400 mb-3 flex items-center gap-2">
              <span>Monthly P&L — {formatMonthName(profitData.delivery_month)} Delivery</span>
              {profitData.marathon.trading_days > 0 && profitData.devon.trading_days > 0 && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                  Closed
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {/* Buy Price (Devon) */}
              {(() => {
                const buyPrice = profitData.devon.buy_price_before_transport !== null
                  ? profitData.devon.buy_price_before_transport - transport
                  : null;
                return (
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                    <div className="text-sm text-slate-400 mb-1">Buy Price (Devon)</div>
                    <div className="text-3xl font-bold text-orange-400">
                      ${buyPrice !== null ? formatPrice(buyPrice) : "--"}
                    </div>
                    <div className="text-sm text-slate-500 mt-2">
                      CMA + Diffs - ${transport.toFixed(2)} transport (Exhibit A)
                    </div>
                    <div className="text-sm text-slate-600 mt-1 font-mono">
                      {profitData.devon.trading_days} trading days ({profitData.devon.period.start.slice(5)} to {profitData.devon.period.end.slice(5)})
                    </div>
                  </div>
                );
              })()}

              {/* Sell Price (Marathon) */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <div className="text-sm text-slate-400 mb-1">Sell Price (Marathon)</div>
                <div className="text-3xl font-bold text-cyan-400">
                  ${profitData.marathon.sell_price !== null
                    ? formatPrice(profitData.marathon.sell_price)
                    : "--"}
                </div>
                <div className="text-sm text-slate-500 mt-2">
                  CMA - $0.25 + Diffs
                </div>
                <div className="text-sm text-slate-600 mt-1 font-mono">
                  {profitData.marathon.trading_days} days ({profitData.marathon.period.start.slice(5)} to {profitData.marathon.period.end.slice(5)})
                </div>
              </div>

              {/* Contract Margin (Exhibit A transport) */}
              {(() => {
                const buyPrice = profitData.devon.buy_price_before_transport !== null
                  ? profitData.devon.buy_price_before_transport - transport
                  : null;
                const margin = buyPrice !== null && profitData.marathon.sell_price !== null
                  ? profitData.marathon.sell_price - buyPrice
                  : null;
                return (
                  <div className={`rounded-xl border p-5 ${
                    margin !== null && margin >= 0
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}>
                    <div className="text-sm text-slate-400 mb-1">Contract Margin</div>
                    <div className={`text-3xl font-bold ${
                      margin !== null && margin >= 0 ? "text-green-400" : "text-red-400"
                    }`}>
                      {margin !== null ? `${margin >= 0 ? "+" : ""}$${formatPrice(margin)}` : "--"}
                    </div>
                    <div className="text-sm text-slate-500 mt-2">per bbl (Exhibit A rate)</div>
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Actual Freight (McLeod) */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <div className="text-sm text-slate-400 mb-1">Actual Freight (McLeod)</div>
                <div className="text-3xl font-bold text-violet-400">
                  ${profitData.freight.total_cost > 0
                    ? profitData.freight.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "--"}
                </div>
                <div className="text-sm text-slate-500 mt-2">
                  {profitData.freight.order_count} transport orders
                </div>
                {profitData.freight.cost_per_bbl !== null && (
                  <div className="text-sm mt-1 font-mono flex items-center gap-2">
                    <span className="text-violet-400">${profitData.freight.cost_per_bbl.toFixed(2)}/bbl</span>
                    <span className={`${profitData.freight.cost_per_bbl < transport ? "text-green-400" : "text-red-400"}`}>
                      ({profitData.freight.cost_per_bbl < transport ? "saves" : "costs"} ${Math.abs(transport - profitData.freight.cost_per_bbl).toFixed(2)} vs Exhibit A)
                    </span>
                  </div>
                )}
              </div>

              {/* Delivered Volume */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                <div className="text-sm text-slate-400 mb-1">Delivered Volume</div>
                <div className="text-3xl font-bold text-white">
                  {profitData.volume.delivered_bbls > 0
                    ? profitData.volume.delivered_bbls.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : "--"}
                </div>
                <div className="text-sm text-slate-500 mt-2">
                  {profitData.volume.ticket_count} tickets
                </div>
                {profitData.volume.shrinkage !== 0 && (
                  <div className="text-sm text-yellow-500 mt-1 font-mono">
                    {profitData.volume.shrinkage > 0 ? "+" : ""}{profitData.volume.shrinkage.toFixed(1)} bbl vs net ({((profitData.volume.shrinkage / profitData.volume.net_barrels) * 100).toFixed(2)}%)
                  </div>
                )}
              </div>

              {/* Net Profit (with actual freight) */}
              {(() => {
                const bbls = profitData.volume.delivered_bbls;
                const grossRevenue = profitData.marathon.sell_price !== null && bbls > 0
                  ? profitData.marathon.sell_price * bbls
                  : null;
                // Devon charges buy_price MINUS Exhibit A transport (the credit is baked into their invoice)
                const devonInvoicePerBbl = profitData.devon.buy_price_before_transport !== null
                  ? profitData.devon.buy_price_before_transport - transport
                  : null;
                const oilCost = devonInvoicePerBbl !== null && bbls > 0
                  ? devonInvoicePerBbl * bbls
                  : null;
                const actualFreight = profitData.freight.total_cost;
                // Net = Marathon revenue - Devon invoice - Actual freight
                const netProfit = grossRevenue !== null && oilCost !== null
                  ? grossRevenue - oilCost - actualFreight
                  : null;
                const netPerBbl = netProfit !== null && bbls > 0
                  ? netProfit / bbls
                  : null;
                return (
                  <div className={`rounded-xl p-5 col-span-1 md:col-span-2 ${
                    netProfit !== null && netProfit >= 0
                      ? "bg-gradient-to-br from-green-600 to-green-700 text-white"
                      : netProfit !== null
                        ? "bg-gradient-to-br from-red-600 to-red-700 text-white"
                        : "bg-slate-800 border border-slate-700"
                  }`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className={`text-sm mb-1 ${netProfit !== null ? "text-white/80" : "text-slate-400"}`}>
                          Net Profit (Actual Freight)
                        </div>
                        <div className="text-3xl font-bold">
                          {netProfit !== null
                            ? `${netProfit >= 0 ? "+" : "-"}$${Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "--"}
                        </div>
                        <div className={`text-sm mt-2 ${netProfit !== null ? (netProfit >= 0 ? "text-green-200" : "text-red-200") : "text-slate-500"}`}>
                          {formatMonthName(profitData.delivery_month)}
                          {netPerBbl !== null && ` | ${netPerBbl >= 0 ? "+" : ""}$${netPerBbl.toFixed(2)}/bbl`}
                        </div>
                      </div>
                      <div className={`text-sm font-mono space-y-0.5 text-right ${netProfit !== null ? (netProfit >= 0 ? "text-green-200" : "text-red-200") : "text-slate-600"}`}>
                        <div>Revenue: ${grossRevenue !== null ? grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--"}</div>
                        <div>Oil cost: ${oilCost !== null ? oilCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--"} (Devon - ${transport.toFixed(2)} Exhibit A)</div>
                        <div>Freight: ${actualFreight.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (McLeod actual)</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

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
            <div className="text-xs text-slate-500 mt-3">
              * See <a href="#exhibit-a" className="text-blue-400 hover:text-blue-300 underline">Exhibit A</a> for lease transportation differentials
            </div>
          </div>
        )}

        {/* Trend Charts */}
        {data?.rows && data.rows.length >= 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {/* Differentials Trend */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Differentials Trend</h3>
              {(() => {
                const rows = [...data.rows].reverse();
                const chartW = 400;
                const chartH = 160;
                const pX = 45;
                const pY = 15;
                const gW = chartW - pX - 15;
                const gH = chartH - pY * 2;

                const cmaDiffs = rows.map((r) => toNum(r.cma_diff_daily)).filter((v): v is number => v !== null);
                const midDiffs = rows.map((r) => toNum(r.midland_diff_daily)).filter((v): v is number => v !== null);
                const allVals = [...cmaDiffs, ...midDiffs];
                if (allVals.length < 2) return <div className="h-32 flex items-center justify-center text-slate-500 text-sm">Not enough data</div>;

                const minV = Math.min(...allVals);
                const maxV = Math.max(...allVals);
                const range = maxV - minV || 0.1;
                const padMin = minV - range * 0.1;
                const padMax = maxV + range * 0.1;
                const padRange = padMax - padMin;

                const toPoints = (vals: (number | null)[]) =>
                  vals.map((v, i) => v !== null ? {
                    x: pX + (i / Math.max(vals.length - 1, 1)) * gW,
                    y: pY + gH - ((v - padMin) / padRange) * gH,
                  } : null);

                const cmaPoints = toPoints(rows.map((r) => toNum(r.cma_diff_daily)));
                const midPoints = toPoints(rows.map((r) => toNum(r.midland_diff_daily)));

                const toPath = (pts: ({ x: number; y: number } | null)[]) =>
                  pts.filter((p): p is { x: number; y: number } => p !== null)
                    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

                // Zero line
                const zeroY = pY + gH - ((0 - padMin) / padRange) * gH;

                return (
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-32 md:h-40">
                    {/* Zero line */}
                    {zeroY >= pY && zeroY <= pY + gH && (
                      <line x1={pX} y1={zeroY} x2={chartW - 15} y2={zeroY} stroke="#475569" strokeWidth="1" strokeDasharray="4,4" />
                    )}
                    {/* Grid */}
                    {[0, 0.5, 1].map((r) => {
                      const y = pY + gH * (1 - r);
                      const val = padMin + padRange * r;
                      return (
                        <g key={r}>
                          <line x1={pX} y1={y} x2={chartW - 15} y2={y} stroke="#1e293b" strokeWidth="1" />
                          <text x={pX - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#64748b" fontFamily="monospace">
                            {val >= 0 ? "+" : ""}{val.toFixed(2)}
                          </text>
                        </g>
                      );
                    })}
                    {/* CMA Diff line */}
                    <path d={toPath(cmaPoints)} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
                    {/* Midland Diff line */}
                    <path d={toPath(midPoints)} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
                    {/* X-axis labels */}
                    {[0, Math.floor(rows.length / 2), rows.length - 1].map((idx) => {
                      if (!rows[idx]) return null;
                      const x = pX + (idx / Math.max(rows.length - 1, 1)) * gW;
                      const d = new Date(rows[idx].report_date.split("T")[0] + "T00:00:00");
                      return (
                        <text key={idx} x={x} y={chartH - 2} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="monospace">
                          {`${d.getMonth() + 1}/${d.getDate()}`}
                        </text>
                      );
                    })}
                  </svg>
                );
              })()}
              <div className="flex items-center gap-4 mt-1 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block"></span><span className="text-slate-400">CMA Diff Daily</span></span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block"></span><span className="text-slate-400">Midland Diff Daily</span></span>
              </div>
            </div>

            {/* Est Net Price Trend */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Est Net Price Trend (MTD)</h3>
              {(() => {
                const rows = [...data.rows].reverse();
                const chartW = 400;
                const chartH = 160;
                const pX = 45;
                const pY = 15;
                const gW = chartW - pX - 15;
                const gH = chartH - pY * 2;

                const estNets = rows.map((r) => {
                  if (isWtlLease) {
                    const wtl = toNum(r.wtl_midland_wtd_avg);
                    return wtl !== null ? wtl - transport : null;
                  }
                  const en = toNum(r.est_net_mtd);
                  return en !== null ? en - transport : null;
                });
                const cmaVals = rows.map((r) => toNum(r.nymex_cma_td));

                const validNets = estNets.filter((v): v is number => v !== null);
                const validCma = cmaVals.filter((v): v is number => v !== null);
                const allVals = [...validNets, ...validCma];
                if (allVals.length < 2) return <div className="h-32 flex items-center justify-center text-slate-500 text-sm">Not enough data</div>;

                const minV = Math.min(...allVals);
                const maxV = Math.max(...allVals);
                const range = maxV - minV || 1;
                const padMin = minV - range * 0.05;
                const padMax = maxV + range * 0.05;
                const padRange = padMax - padMin;

                const toPoints = (vals: (number | null)[]) =>
                  vals.map((v, i) => v !== null ? {
                    x: pX + (i / Math.max(vals.length - 1, 1)) * gW,
                    y: pY + gH - ((v - padMin) / padRange) * gH,
                  } : null);

                const netPoints = toPoints(estNets);
                const cmaPoints = toPoints(cmaVals);

                const toPath = (pts: ({ x: number; y: number } | null)[]) =>
                  pts.filter((p): p is { x: number; y: number } => p !== null)
                    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

                // Fill area under est net line
                const validNetPts = netPoints.filter((p): p is { x: number; y: number } => p !== null);
                const netPath = toPath(netPoints);
                const areaPath = validNetPts.length > 1
                  ? `${netPath} L ${validNetPts[validNetPts.length - 1].x} ${pY + gH} L ${validNetPts[0].x} ${pY + gH} Z`
                  : "";

                const trendUp = validNets.length >= 2 && validNets[validNets.length - 1] >= validNets[0];

                return (
                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-32 md:h-40">
                    <defs>
                      <linearGradient id="estNetGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={trendUp ? "#3b82f6" : "#ef4444"} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={trendUp ? "#3b82f6" : "#ef4444"} stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    {/* Grid */}
                    {[0, 0.25, 0.5, 0.75, 1].map((r) => {
                      const y = pY + gH * (1 - r);
                      const val = padMin + padRange * r;
                      return (
                        <g key={r}>
                          <line x1={pX} y1={y} x2={chartW - 15} y2={y} stroke="#1e293b" strokeWidth="1" />
                          {r % 0.5 === 0 && (
                            <text x={pX - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#64748b" fontFamily="monospace">
                              ${val.toFixed(2)}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    {/* Area fill */}
                    {areaPath && <path d={areaPath} fill="url(#estNetGrad)" />}
                    {/* CMA line (dimmed reference) */}
                    <path d={toPath(cmaPoints)} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.5" />
                    {/* Est Net line */}
                    <path d={netPath} fill="none" stroke={trendUp ? "#3b82f6" : "#ef4444"} strokeWidth="2" strokeLinecap="round" />
                    {/* End dot */}
                    {validNetPts.length > 0 && (
                      <circle cx={validNetPts[validNetPts.length - 1].x} cy={validNetPts[validNetPts.length - 1].y} r="3" fill={trendUp ? "#3b82f6" : "#ef4444"} stroke="#1e293b" strokeWidth="1.5" />
                    )}
                    {/* X-axis */}
                    {[0, Math.floor(rows.length / 2), rows.length - 1].map((idx) => {
                      if (!rows[idx]) return null;
                      const x = pX + (idx / Math.max(rows.length - 1, 1)) * gW;
                      const d = new Date(rows[idx].report_date.split("T")[0] + "T00:00:00");
                      return (
                        <text key={idx} x={x} y={chartH - 2} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="monospace">
                          {`${d.getMonth() + 1}/${d.getDate()}`}
                        </text>
                      );
                    })}
                  </svg>
                );
              })()}
              <div className="flex items-center gap-4 mt-1 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block"></span><span className="text-slate-400">Est Net (after lease diff)</span></span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block opacity-50" style={{ borderTop: "1px dashed" }}></span><span className="text-slate-400">NYMEX CMA</span></span>
              </div>
            </div>
          </div>
        )}

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

        {/* Exhibit A — Lease Transportation Differentials */}
        <div id="exhibit-a" className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mt-8">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-slate-300">Exhibit A — Transportation Differentials</h3>
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
      </div>
    </DashboardLayout>
  );
}
