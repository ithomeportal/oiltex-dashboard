"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Panel } from "@/components/ui/Panel";
import { Field, Segmented } from "@/components/ui/Controls";
import { BTN_PRIMARY, SELECT, STICKY_HEAD, TABLE, TABLE_SCROLL, TD, TD_NUM, TH, TH_NUM, TR } from "@/components/ui/styles";

type ViewMode = "trading" | "calendar";

/** Highlighted WTI Index header (amber instead of the default slate fill). */
const TH_INDEX = TH_NUM.replace("bg-slate-50", "bg-amber-50");

const VIEW_OPTIONS: readonly { value: ViewMode; label: string }[] = [
  { value: "calendar", label: "All Days" },
  { value: "trading", label: "Trading Only" },
];

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
  argusMidland: PriceData[];
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
  const [viewMode, setViewMode] = useState<ViewMode>("trading");

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
    prices?.nymex?.forEach((p) => dateSet.add(normalizeDate(p.date)));
    prices?.chartExport?.forEach((p) => dateSet.add(normalizeDate(p.date)));
    prices?.investingCom?.forEach((p) => dateSet.add(normalizeDate(p.date)));
    prices?.argusMidland?.forEach((p) => dateSet.add(normalizeDate(p.date)));
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
  const fredMap = buildPriceMap(prices?.fred);
  const futuresMap = buildPriceMap(prices?.yahooFutures);
  const midlandMap = buildPriceMap(prices?.yahooMidland);
  const nymexMap = buildPriceMap(prices?.nymex);
  const chartExportMap = buildPriceMap(prices?.chartExport);
  const investingComMap = buildPriceMap(prices?.investingCom);
  const argusMidlandMap = buildPriceMap(prices?.argusMidland);

  // Check if a date is a weekend
  const isWeekend = (dateStr: string) => {
    const normalized = normalizeDate(dateStr);
    const date = new Date(normalized + "T12:00:00"); // Add noon to avoid timezone issues
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <DashboardLayout>
      <Page
        title="Recent Price History"
        subtitle="Historical price data from all sources"
        actions={
          <button onClick={fetchPrices} disabled={loading} className={BTN_PRIMARY}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
        toolbar={
          <>
            <Field label="View">
              <Segmented options={VIEW_OPTIONS} value={viewMode} onChange={setViewMode} ariaLabel="View mode" />
            </Field>
            <Field label="Range" htmlFor="history-days" className="w-44">
              <select
                id="history-days"
                value={daysToShow}
                onChange={(e) => setDaysToShow(parseInt(e.target.value))}
                className={SELECT}
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </Field>
          </>
        }
      >
        {/* Price History Table */}
        <Panel flush>
          <div className={TABLE_SCROLL}>
            <table className={TABLE}>
              <thead className={STICKY_HEAD}>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH_INDEX}>
                    <span className="text-amber-600">WTI Index</span>
                  </th>
                  <th className={TH_NUM}>WTI Spot (EIA)</th>
                  <th className={TH_NUM}>NYMEX Settle</th>
                  <th className={TH_NUM}>WTI Futures (CL)</th>
                  <th className={TH_NUM}>Midland Diff</th>
                  <th className={TH_NUM}>Est. Net Price</th>
                </tr>
              </thead>
              <tbody>
                {dates.slice(0, daysToShow).map((date) => {
                  const weekend = isWeekend(date);

                  // WTI Index: prefer EIA, fallback to FRED, NYMEX settle, Yahoo CL, chart export
                  const getWtiIndex = () => {
                    const eiaVal = eiaMap.get(date);
                    if (eiaVal !== undefined && eiaVal !== null) return { value: eiaVal, isFillForward: false };
                    const fredVal = fredMap.get(date);
                    if (fredVal !== undefined && fredVal !== null) return { value: fredVal, isFillForward: false };
                    const nymexVal = nymexMap.get(date);
                    if (nymexVal !== undefined && nymexVal !== null) return { value: nymexVal, isFillForward: false };
                    const yahooVal = futuresMap.get(date);
                    if (yahooVal !== undefined && yahooVal !== null) return { value: yahooVal, isFillForward: false };
                    const chartVal = chartExportMap.get(date);
                    if (chartVal !== undefined && chartVal !== null) return { value: chartVal, isFillForward: false };
                    if (viewMode === "calendar") {
                      const ffEia = getPriceWithFillForward(date, eiaMap, dates);
                      if (ffEia.value !== null) return ffEia;
                      const ffFred = getPriceWithFillForward(date, fredMap, dates);
                      if (ffFred.value !== null) return ffFred;
                      return getPriceWithFillForward(date, nymexMap, dates);
                    }
                    return { value: null, isFillForward: false };
                  };
                  const wtiIndexData = getWtiIndex();

                  // Get prices - use map lookup (already normalized)
                  const eiaData = viewMode === "calendar"
                    ? getPriceWithFillForward(date, eiaMap, dates)
                    : { value: eiaMap.get(date) ?? null, isFillForward: false };
                  // WTI Futures: prefer NYMEX settle, fallback to Yahoo CL
                  const getFuturesData = () => {
                    const nymexVal = nymexMap.get(date);
                    if (nymexVal !== undefined && nymexVal !== null) return { value: nymexVal, isFillForward: false };
                    const yahooVal = futuresMap.get(date);
                    if (yahooVal !== undefined && yahooVal !== null) return { value: yahooVal, isFillForward: false };
                    if (viewMode === "calendar") {
                      const ff = getPriceWithFillForward(date, nymexMap, dates);
                      if (ff.value !== null) return ff;
                      return getPriceWithFillForward(date, futuresMap, dates);
                    }
                    return { value: null, isFillForward: false };
                  };
                  const futuresData = getFuturesData();
                  // Midland Diff: prefer Argus WTI Midland, fallback to Yahoo WTT
                  const getMidlandData = () => {
                    const argusVal = argusMidlandMap.get(date);
                    if (argusVal !== undefined && argusVal !== null) return { value: argusVal, isFillForward: false };
                    const yahooVal = midlandMap.get(date);
                    if (yahooVal !== undefined && yahooVal !== null) return { value: yahooVal, isFillForward: false };
                    if (viewMode === "calendar") {
                      const ff = getPriceWithFillForward(date, argusMidlandMap, dates);
                      if (ff.value !== null) return ff;
                      return getPriceWithFillForward(date, midlandMap, dates);
                    }
                    return { value: null, isFillForward: false };
                  };
                  const midlandData = getMidlandData();

                  // Get NYMEX settlement - prefer nymex, fallback to chartExport, investingCom, then Yahoo CL
                  const getNymexPrice = () => {
                    const nymexVal = nymexMap.get(date);
                    if (nymexVal !== undefined && nymexVal !== null) return { value: nymexVal, isFillForward: false };
                    const chartVal = chartExportMap.get(date);
                    if (chartVal !== undefined && chartVal !== null) return { value: chartVal, isFillForward: false };
                    const invVal = investingComMap.get(date);
                    if (invVal !== undefined && invVal !== null) return { value: invVal, isFillForward: false };
                    // Fallback to Yahoo CL (front-month WTI futures ≈ NYMEX settle)
                    const yahooVal = futuresMap.get(date);
                    if (yahooVal !== undefined && yahooVal !== null) return { value: yahooVal, isFillForward: false };
                    if (viewMode === "calendar") {
                      const ff = getPriceWithFillForward(date, nymexMap, dates);
                      if (ff.value) return ff;
                      const ffChart = getPriceWithFillForward(date, chartExportMap, dates);
                      if (ffChart.value) return ffChart;
                      return getPriceWithFillForward(date, futuresMap, dates);
                    }
                    return { value: null, isFillForward: false };
                  };
                  const nymexData = getNymexPrice();

                  // Calculate estimated net price (using $2.50 transport as default)
                  const transport = 2.50;
                  // Use NYMEX settlement if available, otherwise futures
                  const basePrice = nymexData.value || futuresData.value;
                  const netPrice = basePrice && midlandData.value
                    ? basePrice + midlandData.value - transport
                    : null;

                  // Format date with day of week
                  const { dayName, dateFormatted } = formatDisplayDate(date);

                  return (
                    <tr key={date} className={weekend ? "bg-slate-100 hover:bg-blue-50/50 transition-colors" : TR}>
                      <td className={TD}>
                        <span className={`font-medium ${weekend ? "text-slate-400" : "text-slate-800"}`}>
                          {dateFormatted} {dayName}
                        </span>
                        {weekend && <span className="ml-2 text-xs text-slate-400">(Wknd)</span>}
                      </td>
                      <td className={`${TD_NUM} bg-amber-50/50`}>
                        <span className={`font-medium ${wtiIndexData.isFillForward ? "text-amber-400 italic" : "text-amber-700"}`}>
                          {wtiIndexData.value ? `$${wtiIndexData.value.toFixed(2)}` : "--"}
                        </span>
                      </td>
                      <td className={TD_NUM}>
                        <span className={eiaData.isFillForward ? "text-slate-400 italic" : "text-slate-800"}>
                          {eiaData.value ? `$${eiaData.value.toFixed(2)}` : "--"}
                        </span>
                      </td>
                      <td className={TD_NUM}>
                        <span className={nymexData.isFillForward ? "text-slate-400 italic" : "text-amber-700 font-medium"}>
                          {nymexData.value ? `$${nymexData.value.toFixed(2)}` : "--"}
                        </span>
                      </td>
                      <td className={TD_NUM}>
                        <span className={futuresData.isFillForward ? "text-slate-400 italic" : "text-slate-800"}>
                          {futuresData.value ? `$${futuresData.value.toFixed(2)}` : "--"}
                        </span>
                      </td>
                      <td className={`${TD_NUM} ${midlandData.isFillForward ? "italic" : ""}`}>
                        {midlandData.value ? (
                          <span className={midlandData.isFillForward ? "text-slate-400" : midlandData.value >= 0 ? "text-good" : "text-bad"}>
                            {midlandData.value >= 0 ? "+" : ""}${midlandData.value.toFixed(2)}
                          </span>
                        ) : "--"}
                      </td>
                      <td className={TD_NUM}>
                        <span className={`font-medium ${(nymexData.isFillForward && futuresData.isFillForward) || midlandData.isFillForward ? "text-slate-400 italic" : "text-blue-600"}`}>
                          {netPrice ? `$${netPrice.toFixed(2)}` : "--"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2 px-4 py-2.5 bg-slate-50 border-t border-line text-xs text-slate-500">
            <span>Showing {Math.min(dates.length, daysToShow)} of {dates.length} records</span>
            {prices?.fetchedAt && <span>Last updated: {new Date(prices.fetchedAt).toLocaleString()}</span>}
          </div>
        </Panel>

        {/* Data Sources Note */}
        <Panel title="Data Sources">
          <ul className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-slate-500">
            <li><strong className="text-slate-700">WTI Index</strong> - Consolidated reference price (EIA → FRED → NYMEX Settle → Yahoo CL)</li>
            <li><strong className="text-slate-700">WTI Spot (EIA)</strong> - U.S. Energy Information Administration RWTC series</li>
            <li><strong className="text-slate-700">NYMEX Settle</strong> - NYMEX WTI settlement price (Argus historical + imported files)</li>
            <li><strong className="text-slate-700">WTI Futures (CL)</strong> - CME NYMEX front-month (NYMEX Settle → Yahoo CL fallback)</li>
            <li><strong className="text-slate-700">Midland Diff</strong> - WTI Midland vs WTI differential (Argus → Yahoo WTT fallback)</li>
            <li><strong className="text-slate-700">Est. Net Price</strong> - (NYMEX Settle or Futures) + Midland Diff - $2.50 Transport</li>
          </ul>
          {viewMode === "calendar" && (
            <p className="mt-3 text-xs text-slate-400 italic">
              * Italicized values on weekends/holidays use the previous trading day&apos;s price (fill-forward).
            </p>
          )}
        </Panel>
      </Page>
    </DashboardLayout>
  );
}
