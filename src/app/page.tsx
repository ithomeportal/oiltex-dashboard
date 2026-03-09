"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";

interface PriceData {
  date: string;
  value: number | null;
  source: string;
  priceType: string;
}

interface LivePrices {
  eia: PriceData[];
  fred: PriceData[];
  yahooFutures: PriceData[];
  yahooMidland: PriceData[];
  nymex: PriceData[];
  chartExport: PriceData[];
  investingCom: PriceData[];
  argusHouston: PriceData[];
  fetchedAt: string;
}

interface WellBreakdown {
  shipper_name: string;
  ticket_count: number;
  delivered_bbls: number;
}

interface ArgusPricingLatest {
  nymex_cma_td: number | null;
  cma_diff_mtd: number | null;
  midland_diff_mtd: number | null;
  est_net_mtd: number | null;
  wtl_midland_wtd_avg: number | null;
  report_date: string;
  contract_month: string;
}

function formatContractMonth(month: string): string {
  const [year, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m, 10) - 1]} ${year}`;
}

interface TradeMonthInfo {
  deliveryMonth: string;
  deliveryYear: number;
  periodStart: string;
  periodEnd: string;
  daysRemaining: number;
  totalDays: number;
}

function getTradeMonthInfo(): TradeMonthInfo {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let tradeMonthStartMonth: number;
  let tradeMonthStartYear: number;
  let deliveryMonth: number;
  let deliveryYear: number;

  if (currentDay >= 26) {
    tradeMonthStartMonth = currentMonth;
    tradeMonthStartYear = currentYear;
    deliveryMonth = currentMonth + 2;
    deliveryYear = currentYear;
  } else {
    tradeMonthStartMonth = currentMonth - 1;
    tradeMonthStartYear = currentYear;
    if (tradeMonthStartMonth < 0) {
      tradeMonthStartMonth = 11;
      tradeMonthStartYear = currentYear - 1;
    }
    deliveryMonth = tradeMonthStartMonth + 2;
    deliveryYear = tradeMonthStartYear;
  }

  if (deliveryMonth > 11) {
    deliveryMonth = deliveryMonth - 12;
    deliveryYear = deliveryYear + 1;
  }

  let tradeMonthEndMonth = deliveryMonth - 1;
  let tradeMonthEndYear = deliveryYear;
  if (tradeMonthEndMonth < 0) {
    tradeMonthEndMonth = 11;
    tradeMonthEndYear = deliveryYear - 1;
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const periodStartDate = new Date(tradeMonthStartYear, tradeMonthStartMonth, 26);
  const periodEndDate = new Date(tradeMonthEndYear, tradeMonthEndMonth, 25);

  let daysRemaining = 0;
  let totalDays = 0;
  const checkDate = new Date(periodStartDate);

  while (checkDate <= periodEndDate) {
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      totalDays++;
      if (checkDate > today) {
        daysRemaining++;
      }
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }

  const formatDate = (date: Date) => {
    return `${monthNames[date.getMonth()].substring(0, 3)} ${date.getDate()}`;
  };

  return {
    deliveryMonth: monthNames[deliveryMonth],
    deliveryYear,
    periodStart: formatDate(periodStartDate),
    periodEnd: formatDate(periodEndDate),
    daysRemaining,
    totalDays
  };
}

// Lease differentials from Exhibit A
const LEASE_DIFF_WTI = 2.26; // highest contractual rate
const LEASE_DIFF_WTL = 2.26;

function ChangeArrow({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <svg className={`w-3 h-3 inline-block ml-0.5 ${value > 0 ? "text-green-400" : "text-red-400 rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
    </svg>
  );
}

function formatDiffSigned(val: number | null | undefined): string {
  if (val === null || val === undefined) return "--";
  return `${val >= 0 ? "+" : ""}${val.toFixed(4)}`;
}

function getLaneMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const options: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${names[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return options;
}

export default function Dashboard() {
  const router = useRouter();
  const laneMonthOptions = useMemo(() => getLaneMonthOptions(), []);
  const [prices, setPrices] = useState<LivePrices | null>(null);
  const [argusPricing, setArgusPricing] = useState<ArgusPricingLatest | null>(null);
  const [ticketLanes, setTicketLanes] = useState<WellBreakdown[]>([]);
  const [laneMonth, setLaneMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prices?days=60");
      const data = await res.json();
      if (data.success) {
        setPrices(data.data);
      }
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArgusPricing = useCallback(async () => {
    try {
      const initRes = await fetch("/api/argus-pricing?month=_");
      const initData = await initRes.json();
      const latestMonth = initData?.data?.months?.[0];
      if (!latestMonth) return;

      const res = await fetch(`/api/argus-pricing?month=${latestMonth}`);
      const data = await res.json();
      if (data.success && data.data.latest) {
        const raw = data.data.latest;
        setArgusPricing({
          nymex_cma_td: raw.nymex_cma_td !== null ? parseFloat(raw.nymex_cma_td) : null,
          cma_diff_mtd: raw.cma_diff_mtd !== null ? parseFloat(raw.cma_diff_mtd) : null,
          midland_diff_mtd: raw.midland_diff_mtd !== null ? parseFloat(raw.midland_diff_mtd) : null,
          est_net_mtd: raw.est_net_mtd !== null ? parseFloat(raw.est_net_mtd) : null,
          wtl_midland_wtd_avg: raw.wtl_midland_wtd_avg !== null ? parseFloat(raw.wtl_midland_wtd_avg) : null,
          report_date: raw.report_date,
          contract_month: raw.contract_month || latestMonth,
        });
      }
    } catch (err) {
      console.error("Error fetching Argus pricing:", err);
    }
  }, []);

  const fetchTicketLanes = useCallback(async (month: string) => {
    try {
      const res = await fetch(`/api/ops-inventory/summary?month=${month}`);
      const json = await res.json();
      if (json.success && json.data?.wells) {
        setTicketLanes(
          json.data.wells.map((w: { shipper_name: string; ticket_count: number; delivered_bbls: number }) => ({
            shipper_name: w.shipper_name,
            ticket_count: w.ticket_count,
            delivered_bbls: w.delivered_bbls,
          }))
        );
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    fetchArgusPricing();
    fetchTicketLanes(laneMonth);
  }, [fetchPrices, fetchArgusPricing, fetchTicketLanes, laneMonth]);

  // Latest market data
  const latestEIA = prices?.eia?.find((p) => p.value !== null);
  const latestFRED = prices?.fred?.find((p) => p.value !== null);
  const latestWTI = latestEIA || latestFRED;
  const latestFutures = prices?.yahooFutures?.find((p) => p.value !== null);
  const latestMidlandDiff = prices?.yahooMidland?.find((p) => p.value !== null);

  const latestNymex = prices?.nymex?.find((p) => p.value !== null);
  const latestChartExport = prices?.chartExport?.find((p) => p.value !== null);
  const latestInvestingCom = prices?.investingCom?.find((p) => p.value !== null);
  const latestSettlement = latestNymex || latestChartExport || latestInvestingCom;

  const spotSource = latestEIA ? "EIA" : (latestFRED ? "FRED" : null);
  const settlementSource = latestNymex ? "NYMEX" : (latestChartExport ? "Chart" : (latestInvestingCom ? "Investing" : null));

  const today = new Date().toISOString().split("T")[0];
  const hasTodayData = !!(
    prices?.yahooFutures?.some((p) => p.date === today) ||
    prices?.yahooMidland?.some((p) => p.date === today)
  );

  // Spot price change
  const spotData = (prices?.eia?.length || 0) > 0 ? prices?.eia : prices?.fred;
  const prevWTI = spotData?.filter((p) => p.value !== null)?.[1];
  const wtiChange = latestWTI?.value && prevWTI?.value ? latestWTI.value - prevWTI.value : 0;
  const wtiChangePct = prevWTI?.value ? (wtiChange / prevWTI.value) * 100 : 0;

  // Argus-derived net prices
  const wtiEstNet = argusPricing?.est_net_mtd !== null && argusPricing?.est_net_mtd !== undefined
    ? argusPricing.est_net_mtd - LEASE_DIFF_WTI
    : null;
  const wtlEstNet = argusPricing?.wtl_midland_wtd_avg !== null && argusPricing?.wtl_midland_wtd_avg !== undefined
    ? argusPricing.wtl_midland_wtd_avg - LEASE_DIFF_WTL
    : null;

  const tradeMonth = getTradeMonthInfo();

  return (
    <DashboardLayout>
      {/* Trade Month Banner */}
      <div className="bg-slate-900 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">Delivery</span>
                <span className="text-white font-bold text-sm">
                  {tradeMonth.deliveryMonth} {tradeMonth.deliveryYear}
                </span>
              </div>
              <div className="hidden sm:block h-4 w-px bg-slate-700"></div>
              <span className="hidden sm:inline text-slate-400 text-xs">
                {tradeMonth.periodStart} — {tradeMonth.periodEnd}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Trading Days</span>
                <span className="font-mono text-sm text-white font-bold">{tradeMonth.daysRemaining}</span>
                <span className="text-slate-500 text-xs">/ {tradeMonth.totalDays}</span>
              </div>
              {hasTodayData && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                  LIVE
                </span>
              )}
              <button
                onClick={() => { fetchPrices(); fetchArgusPricing(); }}
                disabled={loading}
                className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-600 transition-colors disabled:opacity-50"
              >
                {loading ? "..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Market Ticker Strip */}
        <div className="bg-slate-900 rounded-lg border border-slate-700 mb-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-700">
            {/* NYMEX Settlement */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">NYMEX Settle</span>
                <span className="text-[10px] text-slate-600">{settlementSource || "N/A"}</span>
              </div>
              <div className="font-mono text-xl font-bold text-white mt-0.5">
                ${latestSettlement?.value?.toFixed(2) || "--"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{latestSettlement?.date || ""}</div>
            </div>

            {/* WTI Spot */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">WTI Spot</span>
                <span className="text-[10px] text-slate-600">{spotSource || "N/A"}</span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-mono text-xl font-bold text-white">
                  ${latestWTI?.value?.toFixed(2) || "--"}
                </span>
                {wtiChange !== 0 && (
                  <span className={`font-mono text-xs font-medium ${wtiChange >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {wtiChange >= 0 ? "+" : ""}{wtiChange.toFixed(2)} ({wtiChangePct.toFixed(1)}%)
                    <ChangeArrow value={wtiChange} />
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{latestWTI?.date || ""}</div>
            </div>

            {/* WTI Futures */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">WTI Futures CL</span>
                <span className="text-[10px] text-slate-600">NYMEX</span>
              </div>
              <div className="font-mono text-xl font-bold text-white mt-0.5">
                ${latestFutures?.value?.toFixed(2) || "--"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{latestFutures?.date || ""}</div>
            </div>

            {/* Midland Diff */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Midland Diff</span>
                <span className="text-[10px] text-slate-600">CME WTT</span>
              </div>
              <div className="font-mono text-xl font-bold text-white mt-0.5">
                {latestMidlandDiff?.value !== null && latestMidlandDiff?.value !== undefined
                  ? `${latestMidlandDiff.value >= 0 ? "+" : ""}$${latestMidlandDiff.value.toFixed(2)}`
                  : "--"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{latestMidlandDiff?.date || ""}</div>
            </div>
          </div>
        </div>

        {/* Argus Pricing Panel */}
        {argusPricing && (
          <div className="bg-slate-900 rounded-lg border border-slate-700 mb-6">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Argus ACR</span>
                <span className="text-slate-500 text-xs">|</span>
                <span className="text-white text-sm font-semibold">
                  {formatContractMonth(argusPricing.contract_month)} Delivery
                </span>
                <span className="text-slate-500 text-xs">|</span>
                <span className="text-slate-400 text-xs">
                  as of {argusPricing.report_date ? new Date(argusPricing.report_date.split("T")[0] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "N/A"}
                </span>
              </div>
              <Link
                href="/argus-pricing"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Detail View &rarr;
              </Link>
            </div>

            {/* Two-column pricing */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-700">
              {/* WTI Pricing (5 of 6 leases) */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">WTI Pricing</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-medium">5 Leases</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">NYMEX CMA TD</span>
                    <span className="font-mono text-sm text-amber-400 font-medium">
                      ${argusPricing.nymex_cma_td?.toFixed(2) ?? "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">CMA Diff MTD</span>
                    <span className="font-mono text-sm text-white">
                      {formatDiffSigned(argusPricing.cma_diff_mtd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Midland Diff MTD</span>
                    <span className="font-mono text-sm text-green-400">
                      {formatDiffSigned(argusPricing.midland_diff_mtd)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Lease Diff</span>
                    <span className="font-mono text-sm text-red-400">
                      -${LEASE_DIFF_WTI.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-slate-700 pt-1.5 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Est. Net Price</span>
                    <span className="font-mono text-lg text-blue-400 font-bold">
                      ${wtiEstNet !== null ? wtiEstNet.toFixed(2) : "--"}
                    </span>
                  </div>
                </div>
              </div>

              {/* WTL Midland Pricing (GREEN WAVE) */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">WTL Midland</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">GREEN WAVE</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">WTL Midland Wtd Avg</span>
                    <span className="font-mono text-sm text-emerald-400 font-medium">
                      ${argusPricing.wtl_midland_wtd_avg?.toFixed(2) ?? "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Lease Diff</span>
                    <span className="font-mono text-sm text-red-400">
                      -${LEASE_DIFF_WTL.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-slate-700 pt-1.5 flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Est. Net Price</span>
                    <span className="font-mono text-lg text-blue-400 font-bold">
                      ${wtlEstNet !== null ? wtlEstNet.toFixed(2) : "--"}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-600 mt-2 pt-2 border-t border-slate-800">
                    No oil hauled from this lease yet
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 30-Day Chart */}
        <div className="bg-slate-900 rounded-lg border border-slate-700 mb-6">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">30-Day WTI</span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-500 inline-block"></span><span className="text-slate-500">Spot ({spotSource || "N/A"})</span></span>
                {(prices?.argusHouston?.length ?? 0) > 0 && (
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 inline-block"></span><span className="text-slate-500">WTI Houston (Argus)</span></span>
                )}
              </div>
            </div>
          </div>
          <div className="p-4">
            {(() => {
              const validPrices = (spotData || [])
                .filter((p) => p.value !== null)
                .slice(0, 30)
                .reverse();

              if (validPrices.length < 2) {
                return (
                  <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
                    Not enough data to display chart
                  </div>
                );
              }

              // Build Houston overlay data aligned by date
              const houstonByDate = new Map<string, number>();
              (prices?.argusHouston || []).forEach((p) => {
                if (p.value !== null) houstonByDate.set(p.date, p.value);
              });

              const priceValues = validPrices.map((p) => p.value as number);
              const houstonValues = validPrices.map((p) => houstonByDate.get(p.date) ?? null);
              const allValues = [...priceValues, ...houstonValues.filter((v): v is number => v !== null)];

              const minPrice = Math.min(...allValues);
              const maxPrice = Math.max(...allValues);
              const priceRange = maxPrice - minPrice || 1;
              const paddedMin = minPrice - priceRange * 0.1;
              const paddedMax = maxPrice + priceRange * 0.1;
              const paddedRange = paddedMax - paddedMin;

              const chartWidth = 800;
              const chartHeight = 180;
              const paddingX = 45;
              const paddingY = 15;
              const graphWidth = chartWidth - paddingX * 2;
              const graphHeight = chartHeight - paddingY * 2;

              const points = validPrices.map((p, i) => {
                const x = paddingX + (i / (validPrices.length - 1)) * graphWidth;
                const y = paddingY + graphHeight - ((p.value as number - paddedMin) / paddedRange) * graphHeight;
                return { x, y, value: p.value, date: p.date };
              });

              // Houston points
              const houstonPoints = validPrices.map((p, i) => {
                const hVal = houstonByDate.get(p.date);
                if (hVal == null) return null;
                const x = paddingX + (i / (validPrices.length - 1)) * graphWidth;
                const y = paddingY + graphHeight - ((hVal - paddedMin) / paddedRange) * graphHeight;
                return { x, y };
              });

              const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
              const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingY + graphHeight} L ${paddingX} ${paddingY + graphHeight} Z`;

              const houstonPath = houstonPoints
                .filter((p): p is { x: number; y: number } => p !== null)
                .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

              const midPrice = (minPrice + maxPrice) / 2;
              const lastPrice = priceValues[priceValues.length - 1];
              const firstPrice = priceValues[0];
              const trendUp = lastPrice >= firstPrice;

              return (
                <div className="relative">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="w-full h-40 md:h-48"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={trendUp ? "#22c55e" : "#ef4444"} stopOpacity="0.15" />
                        <stop offset="100%" stopColor={trendUp ? "#22c55e" : "#ef4444"} stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = paddingY + graphHeight * (1 - ratio);
                      return (
                        <line key={ratio} x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} stroke="#1e293b" strokeWidth="1" />
                      );
                    })}

                    <path d={areaPath} fill="url(#areaGrad)" />
                    <path d={linePath} fill="none" stroke={trendUp ? "#22c55e" : "#ef4444"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                    {/* WTI Houston overlay */}
                    {houstonPath && (
                      <path d={houstonPath} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="6,3" opacity="0.8" />
                    )}

                    {/* End point */}
                    <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3.5" fill={trendUp ? "#22c55e" : "#ef4444"} stroke="#0f172a" strokeWidth="2" />

                    {/* Y-axis labels */}
                    {[paddedMin, midPrice, paddedMax].map((price, i) => {
                      const y = paddingY + graphHeight - ((price - paddedMin) / paddedRange) * graphHeight;
                      return (
                        <text key={i} x={paddingX - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#475569" fontFamily="monospace">
                          ${price.toFixed(0)}
                        </text>
                      );
                    })}

                    {/* X-axis labels */}
                    {[0, Math.floor(validPrices.length * 0.5), validPrices.length - 1].map((idx) => {
                      if (!validPrices[idx]) return null;
                      const p = points[idx];
                      const d = new Date(validPrices[idx].date);
                      return (
                        <text key={idx} x={p.x} y={chartHeight - 1} textAnchor="middle" fontSize="9" fill="#475569" fontFamily="monospace">
                          {`${d.getMonth() + 1}/${d.getDate()}`}
                        </text>
                      );
                    })}
                  </svg>

                  {/* Chart footer stats */}
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 font-mono">
                    <span>{validPrices.length} days</span>
                    <span>Low ${minPrice.toFixed(2)}</span>
                    <span>High ${maxPrice.toFixed(2)}</span>
                    <span>Range ${(maxPrice - minPrice).toFixed(2)}</span>
                    <span className={trendUp ? "text-green-500" : "text-red-500"}>
                      {trendUp ? "+" : ""}{(lastPrice - firstPrice).toFixed(2)} ({((lastPrice - firstPrice) / firstPrice * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Ticket Volume by Lane */}
        <div className="bg-slate-900 rounded-lg border border-slate-700 mb-6">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Delivery Volume by Lane</span>
              <select
                value={laneMonth}
                onChange={(e) => setLaneMonth(e.target.value)}
                className="bg-slate-800 text-sm text-slate-300 border border-slate-600 rounded px-2 py-1 cursor-pointer hover:bg-slate-700 transition-colors"
              >
                {laneMonthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {ticketLanes.reduce((s, l) => s + l.ticket_count, 0)} tickets | {ticketLanes.reduce((s, l) => s + l.delivered_bbls, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} bbls
            </span>
          </div>
          <div className="p-4">
            {ticketLanes.length > 0 ? (() => {
              const lanes = ticketLanes;
              const maxBbls = Math.max(...lanes.map((l) => l.delivered_bbls));
              const chartW = 800;
              const barH = 36;
              const gap = 10;
              const labelW = 220;
              const valueW = 120;
              const chartH = lanes.length * (barH + gap) + 10;
              const barAreaW = chartW - labelW - valueW;

              return (
                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full" style={{ minHeight: lanes.length * 46 }}>
                  {lanes.map((lane, i) => {
                    const y = i * (barH + gap) + 5;
                    const barW = maxBbls > 0 ? (lane.delivered_bbls / maxBbls) * barAreaW : 0;
                    const shortName = lane.shipper_name.length > 28
                      ? lane.shipper_name.slice(0, 26) + "..."
                      : lane.shipper_name;

                    // Build ticket page URL with shipper filter and date range
                    const [y2, m2] = laneMonth.split("-");
                    const lastDay = new Date(parseInt(y2), parseInt(m2), 0).getDate();
                    const ticketUrl = `/ops-inventory/tickets?shipper=${encodeURIComponent(lane.shipper_name)}&dateFrom=${laneMonth}-01&dateTo=${laneMonth}-${String(lastDay).padStart(2, "0")}`;

                    return (
                      <g
                        key={lane.shipper_name}
                        className="cursor-pointer"
                        onClick={() => router.push(ticketUrl)}
                      >
                        {/* Hover background */}
                        <rect
                          x={0}
                          y={y - 2}
                          width={chartW}
                          height={barH + 4}
                          fill="transparent"
                          className="hover:fill-slate-800/50 transition-colors"
                          rx="4"
                        />
                        {/* Lane name */}
                        <text
                          x={labelW - 8}
                          y={y + barH / 2 + 5}
                          textAnchor="end"
                          fontSize="13"
                          fill="#94a3b8"
                          fontFamily="monospace"
                        >
                          {shortName}
                        </text>
                        {/* Bar */}
                        <rect
                          x={labelW}
                          y={y + 2}
                          width={barW}
                          height={barH - 4}
                          rx="4"
                          fill="#3b82f6"
                          opacity="0.8"
                        />
                        {/* Ticket count badge on bar */}
                        {barW > 50 && (
                          <text
                            x={labelW + 10}
                            y={y + barH / 2 + 5}
                            fontSize="12"
                            fill="white"
                            fontWeight="bold"
                            fontFamily="monospace"
                          >
                            {lane.ticket_count} tix
                          </text>
                        )}
                        {/* Barrel value */}
                        <text
                          x={labelW + barW + 10}
                          y={y + barH / 2 + 5}
                          fontSize="13"
                          fill="#e2e8f0"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {lane.delivered_bbls.toLocaleString(undefined, { maximumFractionDigits: 0 })} bbl
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })() : (
              <div className="text-center text-sm text-slate-500 py-8">No tickets for this month</div>
            )}
          </div>
        </div>

        {/* Footer */}
        {prices?.fetchedAt && (
          <div className="text-center text-[10px] text-slate-600 font-mono">
            Last updated: {new Date(prices.fetchedAt).toLocaleString()}
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
