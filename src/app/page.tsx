"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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

interface TradeMonthInfo {
  deliveryMonth: string;
  deliveryYear: number;
  periodStart: string;
  periodEnd: string;
  daysRemaining: number;
  totalDays: number;
}

// Calculate trade month information
// Trade month for delivery month M runs approximately from 26th of M-2 to 25th of M-1
function getTradeMonthInfo(): TradeMonthInfo {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth(); // 0-indexed
  const currentYear = today.getFullYear();

  // Determine which delivery month we're trading for
  // If we're before the 26th, we're in the trade month that started on the 26th of the previous month
  // If we're on or after the 26th, we're in the new trade month that just started
  let tradeMonthStartMonth: number;
  let tradeMonthStartYear: number;
  let deliveryMonth: number;
  let deliveryYear: number;

  if (currentDay >= 26) {
    // New trade month started this month on the 26th
    tradeMonthStartMonth = currentMonth;
    tradeMonthStartYear = currentYear;
    // Delivery month is 2 months ahead
    deliveryMonth = currentMonth + 2;
    deliveryYear = currentYear;
  } else {
    // Still in trade month that started on the 26th of previous month
    tradeMonthStartMonth = currentMonth - 1;
    tradeMonthStartYear = currentYear;
    if (tradeMonthStartMonth < 0) {
      tradeMonthStartMonth = 11;
      tradeMonthStartYear = currentYear - 1;
    }
    // Delivery month is 2 months ahead of when trade month started
    deliveryMonth = tradeMonthStartMonth + 2;
    deliveryYear = tradeMonthStartYear;
  }

  // Normalize delivery month/year
  if (deliveryMonth > 11) {
    deliveryMonth = deliveryMonth - 12;
    deliveryYear = deliveryYear + 1;
  }

  // Calculate trade month end (25th of M-1, which is 1 month before delivery)
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

  // Calculate days remaining (excluding weekends - simplified)
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

export default function Dashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [prices, setPrices] = useState<LivePrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [transportDiff, setTransportDiff] = useState<string>("2.50");

  // Check authentication
  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.email) setEmail(data.email);
        if (data.isAdmin) setIsAdmin(data.isAdmin);
        if (!data.authenticated) {
          router.push("/login");
        }
      });
  }, [router]);

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prices?source=live&days=30");
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

  useEffect(() => {
    if (authenticated) {
      fetchPrices();
    }
  }, [authenticated, fetchPrices]);

  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  // Get latest values
  const latestWTI = prices?.eia?.find((p) => p.value !== null);
  const latestFutures = prices?.yahooFutures?.find((p) => p.value !== null);
  const latestMidlandDiff = prices?.yahooMidland?.find((p) => p.value !== null);

  // Calculate estimated pricing
  const nymexBase = latestFutures?.value || 0;
  const midlandDiff = latestMidlandDiff?.value || 0;
  const transport = parseFloat(transportDiff) || 0;
  const estimatedPrice = nymexBase + midlandDiff - transport;

  // Calculate CMA from available data
  const calculateCMA = (data: PriceData[]) => {
    const validPrices = data?.filter((p) => p.value !== null) || [];
    if (validPrices.length === 0) return null;
    const sum = validPrices.reduce((acc, p) => acc + (p.value || 0), 0);
    return (sum / validPrices.length).toFixed(2);
  };

  const eiaCMA = calculateCMA(prices?.eia || []);
  const futuresCMA = calculateCMA(prices?.yahooFutures || []);

  // Get trade month information
  const tradeMonth = getTradeMonthInfo();

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              OilTex Price Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && (
              <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
                Admin
              </span>
            )}
            <span className="text-sm text-slate-600">{email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Trade Month Indicator Banner */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 border-b border-slate-600">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Trade Month</span>
                <div className="text-white font-semibold">
                  {tradeMonth.deliveryMonth} {tradeMonth.deliveryYear} Delivery
                </div>
              </div>
              <div className="hidden sm:block h-8 w-px bg-slate-600"></div>
              <div className="hidden sm:block">
                <span className="text-slate-400 text-xs uppercase tracking-wide">Trading Period</span>
                <div className="text-slate-200 text-sm">
                  {tradeMonth.periodStart} - {tradeMonth.periodEnd}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-slate-400 text-xs uppercase tracking-wide">Days Remaining</span>
                <div className="text-white font-semibold">
                  {tradeMonth.daysRemaining} <span className="text-slate-400 font-normal text-sm">of {tradeMonth.totalDays} trading days</span>
                </div>
              </div>
              <div className="hidden md:block" title="Trading days exclude weekends and US holidays">
                <svg className="w-4 h-4 text-slate-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Note: Trading days exclude weekends and US holidays. Dates are approximate.
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Refresh button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={fetchPrices}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Prices"}
          </button>
        </div>

        {/* Price Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* WTI Spot (EIA) */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">WTI Cushing Spot</div>
            <div className="text-3xl font-bold text-slate-800">
              ${latestWTI?.value?.toFixed(2) || "--"}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              EIA | {latestWTI?.date || "N/A"}
            </div>
          </div>

          {/* WTI Futures (Yahoo) */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">WTI Futures (CL)</div>
            <div className="text-3xl font-bold text-slate-800">
              ${latestFutures?.value?.toFixed(2) || "--"}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              NYMEX | {latestFutures?.date || "N/A"}
            </div>
          </div>

          {/* WTI Midland Differential */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="text-sm text-slate-500 mb-1">
              WTI Midland Diff (vs Cushing)
            </div>
            <div className="text-3xl font-bold text-green-600">
              +${latestMidlandDiff?.value?.toFixed(2) || "--"}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              CME WTT | {latestMidlandDiff?.date || "N/A"}
            </div>
          </div>

          {/* Estimated Price */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-sm p-6 text-white">
            <div className="text-sm text-blue-100 mb-1">Estimated Net Price</div>
            <div className="text-3xl font-bold">
              ${estimatedPrice.toFixed(2)}
            </div>
            <div className="text-xs text-blue-200 mt-2">
              NYMEX + Midland Diff - Transport
            </div>
          </div>
        </div>

        {/* CMA Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Calendar Month Average (CMA)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">EIA Spot CMA (30 days)</span>
                <span className="font-semibold text-slate-800">
                  ${eiaCMA || "--"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600">Futures CMA (30 days)</span>
                <span className="font-semibold text-slate-800">
                  ${futuresCMA || "--"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-600">Trading Days</span>
                <span className="font-semibold text-slate-800">
                  {prices?.eia?.filter((p) => p.value !== null).length || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Price Calculator */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Price Calculator
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-600">
                  Transportation Differential ($/BBL)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={transportDiff}
                  onChange={(e) => setTransportDiff(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm text-slate-500 mb-2">Pricing Formula:</div>
                <div className="font-mono text-sm text-slate-700">
                  <div>NYMEX CMA TD: ${futuresCMA || "--"}</div>
                  <div>+ Midland Diff: ${latestMidlandDiff?.value?.toFixed(2) || "--"}</div>
                  <div>- Transport: ${transport.toFixed(2)}</div>
                  <div className="border-t border-slate-300 mt-2 pt-2 font-bold">
                    = Net Price: ${(parseFloat(futuresCMA || "0") + midlandDiff - transport).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 30-Day WTI Price Trend Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 mb-8">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            30-Day WTI Spot Price Trend
          </h3>
          {(() => {
            // Get valid EIA prices and reverse for chronological order
            const validPrices = (prices?.eia || [])
              .filter((p) => p.value !== null)
              .slice(0, 30)
              .reverse();

            if (validPrices.length < 2) {
              return (
                <div className="h-48 flex items-center justify-center text-slate-400">
                  Not enough data to display chart
                </div>
              );
            }

            const priceValues = validPrices.map((p) => p.value as number);
            const minPrice = Math.min(...priceValues);
            const maxPrice = Math.max(...priceValues);
            const priceRange = maxPrice - minPrice || 1;

            // Add some padding to the price range for better visualization
            const paddedMin = minPrice - priceRange * 0.1;
            const paddedMax = maxPrice + priceRange * 0.1;
            const paddedRange = paddedMax - paddedMin;

            // Chart dimensions
            const chartWidth = 800;
            const chartHeight = 200;
            const paddingX = 50;
            const paddingY = 20;
            const graphWidth = chartWidth - paddingX * 2;
            const graphHeight = chartHeight - paddingY * 2;

            // Calculate points
            const points = validPrices.map((p, i) => {
              const x = paddingX + (i / (validPrices.length - 1)) * graphWidth;
              const y = paddingY + graphHeight - ((p.value as number - paddedMin) / paddedRange) * graphHeight;
              return { x, y, value: p.value, date: p.date };
            });

            // Create SVG path for line
            const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

            // Create area path (fill under line)
            const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingY + graphHeight} L ${paddingX} ${paddingY + graphHeight} Z`;

            // Calculate mid price for reference line
            const midPrice = (minPrice + maxPrice) / 2;

            return (
              <div className="relative">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-48 md:h-56"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Gradient for area fill */}
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>

                  {/* Background grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = paddingY + graphHeight * (1 - ratio);
                    return (
                      <line
                        key={ratio}
                        x1={paddingX}
                        y1={y}
                        x2={chartWidth - paddingX}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                        strokeDasharray={ratio === 0.5 ? "none" : "4,4"}
                      />
                    );
                  })}

                  {/* Area fill */}
                  <path d={areaPath} fill="url(#areaGradient)" />

                  {/* Line */}
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Data points - show fewer for cleaner look */}
                  {points.filter((_, i) => i === 0 || i === points.length - 1 || i % 5 === 0).map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  ))}

                  {/* Max price marker */}
                  {(() => {
                    const maxPoint = points.reduce((max, p) => (p.value as number) > (max.value as number) ? p : max, points[0]);
                    return (
                      <g>
                        <circle cx={maxPoint.x} cy={maxPoint.y} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                        <text x={maxPoint.x} y={maxPoint.y - 10} textAnchor="middle" fontSize="10" fill="#10b981" fontWeight="600">
                          ${(maxPoint.value as number).toFixed(2)}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Min price marker */}
                  {(() => {
                    const minPoint = points.reduce((min, p) => (p.value as number) < (min.value as number) ? p : min, points[0]);
                    return (
                      <g>
                        <circle cx={minPoint.x} cy={minPoint.y} r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                        <text x={minPoint.x} y={minPoint.y + 16} textAnchor="middle" fontSize="10" fill="#ef4444" fontWeight="600">
                          ${(minPoint.value as number).toFixed(2)}
                        </text>
                      </g>
                    );
                  })()}

                  {/* Y-axis labels */}
                  <text
                    x={paddingX - 8}
                    y={paddingY + graphHeight + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
                  >
                    ${paddedMin.toFixed(0)}
                  </text>
                  <text
                    x={paddingX - 8}
                    y={paddingY + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
                  >
                    ${paddedMax.toFixed(0)}
                  </text>
                  <text
                    x={paddingX - 8}
                    y={paddingY + graphHeight / 2 + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
                  >
                    ${midPrice.toFixed(0)}
                  </text>

                  {/* X-axis labels */}
                  <text
                    x={paddingX}
                    y={chartHeight - 2}
                    textAnchor="start"
                    fontSize="10"
                    fill="#94a3b8"
                  >
                    {validPrices[0]?.date}
                  </text>
                  <text
                    x={chartWidth - paddingX}
                    y={chartHeight - 2}
                    textAnchor="end"
                    fontSize="10"
                    fill="#94a3b8"
                  >
                    {validPrices[validPrices.length - 1]?.date}
                  </text>
                </svg>

                {/* Legend */}
                <div className="flex items-center justify-between mt-3 text-sm">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-slate-600">WTI Spot (EIA)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-slate-600">High</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-slate-600">Low</span>
                    </div>
                  </div>
                  <div className="text-slate-400">
                    {validPrices.length} trading days | Range: ${(maxPrice - minPrice).toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Price History Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800">
              Recent Price History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    WTI Spot (EIA)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    WTI Futures
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Midland Diff
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {prices?.eia?.slice(0, 30).map((price, i) => {
                  const futuresPrice = prices.yahooFutures?.find(
                    (p) => p.date === price.date
                  );
                  const midlandPrice = prices.yahooMidland?.find(
                    (p) => p.date === price.date
                  );
                  return (
                    <tr key={price.date} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="px-6 py-3 text-sm text-slate-800">
                        {price.date}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-800 text-right">
                        ${price.value?.toFixed(2) || "--"}
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-800 text-right">
                        ${futuresPrice?.value?.toFixed(2) || "--"}
                      </td>
                      <td className="px-6 py-3 text-sm text-green-600 text-right">
                        {midlandPrice?.value
                          ? `+$${midlandPrice.value.toFixed(2)}`
                          : "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Last Updated */}
        {prices?.fetchedAt && (
          <div className="mt-8 text-center text-sm text-slate-500">
            <p>Last updated: {new Date(prices.fetchedAt).toLocaleString()}</p>
          </div>
        )}
      </main>
    </div>
  );
}
