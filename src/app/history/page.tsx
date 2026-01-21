"use client";

import { useState, useEffect, useCallback } from "react";
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
  fetchedAt: string;
}

// Normalize date to YYYY-MM-DD format
function normalizeDate(dateStr: string): string {
  if (!dateStr) return "";
  // Handle various date formats
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toISOString().split("T")[0];
}

// Format date for display (e.g., "Mon 2026-01-21")
function formatDisplayDate(dateStr: string): { dayName: string; dateFormatted: string } {
  const normalized = normalizeDate(dateStr);
  const date = new Date(normalized + "T12:00:00"); // Add noon to avoid timezone issues
  if (isNaN(date.getTime())) {
    return { dayName: "", dateFormatted: dateStr };
  }
  const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
  return { dayName, dateFormatted: normalized };
}

export default function HistoryPage() {
  const [prices, setPrices] = useState<LivePrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [daysToShow, setDaysToShow] = useState(30);
  const [viewMode, setViewMode] = useState<"trading" | "calendar">("calendar");

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/prices?days=${daysToShow}`);
      const data = await res.json();
      if (data.success) {
        setPrices(data.data);
      }
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setLoading(false);
    }
  }, [daysToShow]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Get trading days only (days with actual data) - normalized to YYYY-MM-DD
  const getTradingDates = () => {
    const dateSet = new Set<string>();
    prices?.eia?.forEach((p) => dateSet.add(normalizeDate(p.date)));
    prices?.yahooFutures?.forEach((p) => dateSet.add(normalizeDate(p.date)));
    prices?.yahooMidland?.forEach((p) => dateSet.add(normalizeDate(p.date)));
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  };

  // Get all calendar days within range
  const getCalendarDates = () => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split("T")[0]);
    }
    return dates;
  };

  // Build price map for quick lookups - normalize dates to YYYY-MM-DD
  const buildPriceMap = (priceArray: PriceData[] | undefined) => {
    const map = new Map<string, number | null>();
    priceArray?.forEach((p) => map.set(normalizeDate(p.date), p.value));
    return map;
  };

  // Get price with fill-forward for non-trading days
  const getPriceWithFillForward = (
    date: string,
    priceMap: Map<string, number | null>,
    allDates: string[]
  ): { value: number | null; isFillForward: boolean } => {
    if (priceMap.has(date)) {
      return { value: priceMap.get(date) ?? null, isFillForward: false };
    }
    // Look backwards for the most recent trading day price
    const dateObj = new Date(date);
    for (let i = 1; i <= 10; i++) {
      const prevDate = new Date(dateObj);
      prevDate.setDate(prevDate.getDate() - i);
      const prevDateStr = prevDate.toISOString().split("T")[0];
      if (priceMap.has(prevDateStr)) {
        return { value: priceMap.get(prevDateStr) ?? null, isFillForward: true };
      }
    }
    return { value: null, isFillForward: false };
  };

  const tradingDates = getTradingDates();
  const calendarDates = getCalendarDates();
  const dates = viewMode === "trading" ? tradingDates : calendarDates;

  // Build price maps for fill-forward lookups
  const eiaMap = buildPriceMap(prices?.eia);
  const futuresMap = buildPriceMap(prices?.yahooFutures);
  const midlandMap = buildPriceMap(prices?.yahooMidland);

  // Check if a date is a weekend
  const isWeekend = (dateStr: string) => {
    const normalized = normalizeDate(dateStr);
    const date = new Date(normalized + "T12:00:00"); // Add noon to avoid timezone issues
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Recent Price History</h1>
              <p className="text-slate-500 text-sm mt-1">
                Historical price data from all sources
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setViewMode("calendar")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === "calendar"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  All Days
                </button>
                <button
                  onClick={() => setViewMode("trading")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === "trading"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Trading Only
                </button>
              </div>
              <select
                value={daysToShow}
                onChange={(e) => setDaysToShow(parseInt(e.target.value))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button
                onClick={fetchPrices}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Price History Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      WTI Spot (EIA)
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      WTI Futures (CL)
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Midland Diff
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Est. Net Price
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dates.slice(0, daysToShow).map((date, i) => {
                    const weekend = isWeekend(date);

                    // Get prices - use map lookup (already normalized)
                    const eiaData = viewMode === "calendar"
                      ? getPriceWithFillForward(date, eiaMap, dates)
                      : { value: eiaMap.get(date) ?? null, isFillForward: false };
                    const futuresData = viewMode === "calendar"
                      ? getPriceWithFillForward(date, futuresMap, dates)
                      : { value: futuresMap.get(date) ?? null, isFillForward: false };
                    const midlandData = viewMode === "calendar"
                      ? getPriceWithFillForward(date, midlandMap, dates)
                      : { value: midlandMap.get(date) ?? null, isFillForward: false };

                    // Calculate estimated net price (using $2.50 transport as default)
                    const transport = 2.50;
                    const netPrice = futuresData.value && midlandData.value
                      ? futuresData.value + midlandData.value - transport
                      : null;

                    // Format date with day of week
                    const { dayName, dateFormatted } = formatDisplayDate(date);

                    return (
                      <tr
                        key={date}
                        className={`${weekend ? "bg-slate-100" : i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                      >
                        <td className="px-6 py-3 text-sm font-medium">
                          <span className={weekend ? "text-slate-400" : "text-slate-800"}>
                            {dayName} {dateFormatted}
                          </span>
                          {weekend && (
                            <span className="ml-2 text-xs text-slate-400">(Weekend)</span>
                          )}
                        </td>
                        <td className={`px-6 py-3 text-sm text-right ${eiaData.isFillForward ? "text-slate-400 italic" : "text-slate-800"}`}>
                          {eiaData.value ? `$${eiaData.value.toFixed(2)}` : "--"}
                        </td>
                        <td className={`px-6 py-3 text-sm text-right ${futuresData.isFillForward ? "text-slate-400 italic" : "text-slate-800"}`}>
                          {futuresData.value ? `$${futuresData.value.toFixed(2)}` : "--"}
                        </td>
                        <td className={`px-6 py-3 text-sm text-right ${midlandData.isFillForward ? "italic" : ""}`}>
                          {midlandData.value ? (
                            <span className={midlandData.isFillForward ? "text-slate-400" : midlandData.value >= 0 ? "text-green-600" : "text-red-600"}>
                              {midlandData.value >= 0 ? "+" : ""}${midlandData.value.toFixed(2)}
                            </span>
                          ) : "--"}
                        </td>
                        <td className={`px-6 py-3 text-sm font-medium text-right ${futuresData.isFillForward || midlandData.isFillForward ? "text-slate-400 italic" : "text-blue-600"}`}>
                          {netPrice ? `$${netPrice.toFixed(2)}` : "--"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
              <div className="flex justify-between items-center text-sm text-slate-500">
                <span>Showing {Math.min(dates.length, daysToShow)} of {dates.length} records</span>
                {prices?.fetchedAt && (
                  <span>Last updated: {new Date(prices.fetchedAt).toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>

          {/* Data Sources Note */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Data Sources</h3>
            <ul className="text-xs text-slate-500 space-y-1">
              <li><strong>WTI Spot (EIA)</strong> - U.S. Energy Information Administration RWTC series</li>
              <li><strong>WTI Futures</strong> - CME NYMEX Light Sweet Crude Oil (CL) front-month contract</li>
              <li><strong>Midland Diff</strong> - CME WTI Midland vs WTI differential (WTT)</li>
              <li><strong>Est. Net Price</strong> - Futures + Midland Diff - $2.50 Transport</li>
            </ul>
            {viewMode === "calendar" && (
              <p className="mt-3 text-xs text-slate-400 italic">
                * Italicized values on weekends/holidays use the previous trading day&apos;s price (fill-forward).
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
