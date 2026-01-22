"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";

interface AnnualData {
  year: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  tradingDays: number;
  percentChange: number | null;
}

interface HistoricalPoint {
  date: string;
  price: number;
}

type TimeRange = "ytd" | "1y" | "5y" | "10y" | "all";

export default function AnalyticsPage() {
  const [annualData, setAnnualData] = useState<AnnualData[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [loading, setLoading] = useState(true);
  const [annualChartType, setAnnualChartType] = useState<"performance" | "average">("average");

  useEffect(() => {
    fetchAnnualData();
  }, []);

  useEffect(() => {
    fetchHistoricalData(timeRange);
  }, [timeRange]);

  const fetchAnnualData = async () => {
    try {
      const res = await fetch("/api/analytics?type=annual");
      const data = await res.json();
      if (data.success) {
        setAnnualData(data.data);
      }
    } catch (error) {
      console.error("Error fetching annual data:", error);
    }
  };

  const fetchHistoricalData = async (range: TimeRange) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?type=historical&range=${range}`);
      const data = await res.json();
      if (data.success) {
        setHistoricalData(data.data);
      }
    } catch (error) {
      console.error("Error fetching historical data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Annual Performance Chart (green/red bars)
  const renderPerformanceChart = () => {
    const dataWithChange = annualData.filter((d) => d.percentChange !== null);
    if (dataWithChange.length === 0) return null;

    const maxChange = Math.max(...dataWithChange.map((d) => Math.abs(d.percentChange!)));
    const chartWidth = 900;
    const chartHeight = 300;
    const barWidth = Math.min(20, (chartWidth - 100) / dataWithChange.length - 2);
    const paddingX = 50;
    const paddingY = 40;
    const graphHeight = chartHeight - paddingY * 2;
    const midY = paddingY + graphHeight / 2;

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-64 md:h-80">
        {/* Zero line */}
        <line x1={paddingX} y1={midY} x2={chartWidth - 20} y2={midY} stroke="#94a3b8" strokeWidth="1" />

        {/* Grid lines */}
        {[-75, -50, -25, 25, 50, 75].map((pct) => {
          const y = midY - (pct / maxChange) * (graphHeight / 2) * 0.9;
          if (y < paddingY || y > chartHeight - paddingY) return null;
          return (
            <g key={pct}>
              <line x1={paddingX} y1={y} x2={chartWidth - 20} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
              <text x={paddingX - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                {pct}%
              </text>
            </g>
          );
        })}

        {/* Y-axis label */}
        <text x={paddingX - 5} y={midY + 4} textAnchor="end" fontSize="10" fill="#64748b" fontWeight="600">
          0%
        </text>

        {/* Bars */}
        {dataWithChange.map((d, i) => {
          const x = paddingX + (i / dataWithChange.length) * (chartWidth - paddingX - 40) + barWidth / 2;
          const barHeight = Math.abs(d.percentChange!) / maxChange * (graphHeight / 2) * 0.9;
          const isPositive = d.percentChange! >= 0;
          const y = isPositive ? midY - barHeight : midY;

          return (
            <g key={d.year}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={isPositive ? "#22c55e" : "#ef4444"}
                rx="2"
              />
              {/* Year labels - show every 5 years */}
              {d.year % 5 === 0 && (
                <text x={x + barWidth / 2} y={chartHeight - 10} textAnchor="middle" fontSize="10" fill="#64748b">
                  {d.year}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  // Annual Average Price Chart (blue bars)
  const renderAverageChart = () => {
    if (annualData.length === 0) return null;

    const maxPrice = Math.max(...annualData.map((d) => d.avgPrice));
    const chartWidth = 900;
    const chartHeight = 300;
    const barWidth = Math.min(20, (chartWidth - 100) / annualData.length - 2);
    const paddingX = 50;
    const paddingY = 30;
    const graphHeight = chartHeight - paddingY * 2;

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-64 md:h-80">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const price = (pct / 100) * maxPrice;
          const y = paddingY + graphHeight - (pct / 100) * graphHeight;
          return (
            <g key={pct}>
              <line x1={paddingX} y1={y} x2={chartWidth - 20} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={pct === 0 ? "none" : "4,4"} />
              <text x={paddingX - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                ${price.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {annualData.map((d, i) => {
          const x = paddingX + (i / annualData.length) * (chartWidth - paddingX - 40) + barWidth / 2;
          const barHeight = (d.avgPrice / maxPrice) * graphHeight;
          const y = paddingY + graphHeight - barHeight;

          return (
            <g key={d.year}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="#3b82f6"
                rx="2"
              />
              {/* Year labels - show every 5 years */}
              {d.year % 5 === 0 && (
                <text x={x + barWidth / 2} y={chartHeight - 5} textAnchor="middle" fontSize="10" fill="#64748b">
                  {d.year}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  // Historical Line Chart
  const renderHistoricalChart = () => {
    if (historicalData.length < 2) {
      return (
        <div className="h-64 flex items-center justify-center text-slate-400">
          {loading ? "Loading..." : "Not enough data to display chart"}
        </div>
      );
    }

    const prices = historicalData.map((d) => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;
    const paddedMin = minPrice - priceRange * 0.05;
    const paddedMax = maxPrice + priceRange * 0.05;
    const paddedRange = paddedMax - paddedMin;

    const chartWidth = 900;
    const chartHeight = 350;
    const paddingX = 50;
    const paddingY = 30;
    const graphWidth = chartWidth - paddingX - 30;
    const graphHeight = chartHeight - paddingY * 2;

    // Sample points for performance (max 500 points)
    const sampleRate = Math.max(1, Math.floor(historicalData.length / 500));
    const sampledData = historicalData.filter((_, i) => i % sampleRate === 0 || i === historicalData.length - 1);

    const points = sampledData.map((d, i) => {
      const x = paddingX + (i / (sampledData.length - 1)) * graphWidth;
      const y = paddingY + graphHeight - ((d.price - paddedMin) / paddedRange) * graphHeight;
      return { x, y, price: d.price, date: d.date };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingY + graphHeight} L ${paddingX} ${paddingY + graphHeight} Z`;

    // Calculate change
    const firstPrice = historicalData[0]?.price || 0;
    const lastPrice = historicalData[historicalData.length - 1]?.price || 0;
    const priceChangePercent = firstPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
    const isPositive = priceChangePercent >= 0;

    return (
      <div>
        {/* Stats row */}
        <div className="flex gap-6 mb-4 text-sm">
          <div>
            <span className="text-slate-500">Period:</span>{" "}
            <span className="font-medium">{historicalData[0]?.date} to {historicalData[historicalData.length - 1]?.date}</span>
          </div>
          <div>
            <span className="text-slate-500">Change:</span>{" "}
            <span className={`font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
              {isPositive ? "+" : ""}{priceChangePercent.toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="text-slate-500">Range:</span>{" "}
            <span className="font-medium">${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-72 md:h-96">
          <defs>
            <linearGradient id="histGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0.3" />
              <stop offset="100%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingY + graphHeight * (1 - ratio);
            const price = paddedMin + paddedRange * ratio;
            return (
              <g key={ratio}>
                <line x1={paddingX} y1={y} x2={chartWidth - 30} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={ratio === 0 ? "none" : "4,4"} />
                <text x={paddingX - 5} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                  ${price.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#histGradient)" />

          {/* Line */}
          <path d={linePath} fill="none" stroke={isPositive ? "#22c55e" : "#ef4444"} strokeWidth="2" />

          {/* X-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const idx = Math.floor(ratio * (sampledData.length - 1));
            const d = sampledData[idx];
            if (!d) return null;
            const x = paddingX + ratio * graphWidth;
            const label = new Date(d.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
            return (
              <text key={ratio} x={x} y={chartHeight - 5} textAnchor="middle" fontSize="10" fill="#64748b">
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800">Price Analytics</h1>
            <p className="text-slate-500 text-sm mt-1">
              Historical WTI crude oil price analysis (1987-2026)
            </p>
          </div>

          {/* Historical Price Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">WTI Price History</h2>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                {(["ytd", "1y", "5y", "10y", "all"] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      timeRange === range
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {renderHistoricalChart()}
          </div>

          {/* Annual Charts */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-800">
                {annualChartType === "performance" ? "Annual Performance" : "Annual Average Price"}
              </h2>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setAnnualChartType("average")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    annualChartType === "average"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Avg Price
                </button>
                <button
                  onClick={() => setAnnualChartType("performance")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    annualChartType === "performance"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  YoY Change
                </button>
              </div>
            </div>
            {annualChartType === "performance" ? renderPerformanceChart() : renderAverageChart()}
            <div className="mt-4 text-xs text-slate-500">
              {annualChartType === "performance"
                ? "Year-over-year percentage change in average WTI price. Green = increase, Red = decrease."
                : "Annual average WTI crude oil price per barrel."}
            </div>
          </div>

          {/* Annual Data Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Annual Statistics</h2>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Year</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Avg Price</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Min</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Max</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">YoY Change</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Trading Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[...annualData].reverse().map((d) => (
                    <tr key={d.year} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-sm font-medium text-slate-800">{d.year}</td>
                      <td className="px-4 py-2 text-sm text-right text-slate-800">${d.avgPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-slate-600">${d.minPrice.toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm text-right text-slate-600">${d.maxPrice.toFixed(2)}</td>
                      <td className={`px-4 py-2 text-sm text-right font-medium ${
                        d.percentChange === null ? "text-slate-400" :
                        d.percentChange >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {d.percentChange !== null ? `${d.percentChange >= 0 ? "+" : ""}${d.percentChange.toFixed(1)}%` : "--"}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-slate-600">{d.tradingDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
