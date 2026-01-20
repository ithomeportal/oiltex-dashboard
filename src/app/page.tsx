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

export default function Dashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
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

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              OilTex Price Dashboard
            </h1>
            <p className="text-sm text-slate-500">
              WTI Crude Oil Pricing for New Mexico Purchases
            </p>
          </div>
          <div className="flex items-center gap-4">
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
                {prices?.eia?.slice(0, 15).map((price, i) => {
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

        {/* Data Sources */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>
            Data sources: EIA (U.S. Energy Information Administration), FRED
            (Federal Reserve), CME Group via Yahoo Finance
          </p>
          {prices?.fetchedAt && (
            <p className="mt-1">
              Last updated: {new Date(prices.fetchedAt).toLocaleString()}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
