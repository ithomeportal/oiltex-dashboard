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

export default function HistoryPage() {
  const [prices, setPrices] = useState<LivePrices | null>(null);
  const [loading, setLoading] = useState(false);
  const [daysToShow, setDaysToShow] = useState(30);

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

  // Combine all dates from all sources
  const getAllDates = () => {
    const dateSet = new Set<string>();
    prices?.eia?.forEach((p) => dateSet.add(p.date));
    prices?.yahooFutures?.forEach((p) => dateSet.add(p.date));
    prices?.yahooMidland?.forEach((p) => dateSet.add(p.date));
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  };

  const dates = getAllDates();

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
                    const eiaPrice = prices?.eia?.find((p) => p.date === date);
                    const futuresPrice = prices?.yahooFutures?.find((p) => p.date === date);
                    const midlandPrice = prices?.yahooMidland?.find((p) => p.date === date);

                    // Calculate estimated net price (using $2.50 transport as default)
                    const transport = 2.50;
                    const netPrice = futuresPrice?.value && midlandPrice?.value
                      ? futuresPrice.value + midlandPrice.value - transport
                      : null;

                    return (
                      <tr key={date} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="px-6 py-3 text-sm text-slate-800 font-medium">
                          {date}
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-800 text-right">
                          {eiaPrice?.value ? `$${eiaPrice.value.toFixed(2)}` : "--"}
                        </td>
                        <td className="px-6 py-3 text-sm text-slate-800 text-right">
                          {futuresPrice?.value ? `$${futuresPrice.value.toFixed(2)}` : "--"}
                        </td>
                        <td className="px-6 py-3 text-sm text-right">
                          {midlandPrice?.value ? (
                            <span className={midlandPrice.value >= 0 ? "text-green-600" : "text-red-600"}>
                              {midlandPrice.value >= 0 ? "+" : ""}${midlandPrice.value.toFixed(2)}
                            </span>
                          ) : "--"}
                        </td>
                        <td className="px-6 py-3 text-sm text-blue-600 font-medium text-right">
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
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
