"use client";

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Panel } from "@/components/ui/Panel";
import { GRID_2, STICKY_HEAD, TABLE, TABLE_SCROLL, TD, TD_NUM, TH, TH_NUM, TR } from "@/components/ui/styles";
import { fmtMoney } from "@/lib/format";
import {
  AnnualAveragePanel,
  AnnualPerformancePanel,
  FuturesCurvePanel,
  HistoricalPanel,
  type AnnualData,
  type FuturesCurvePoint,
  type FuturesRange,
  type HistoricalPoint,
  type TimeRange,
} from "./_components/AnalyticsCharts";

export default function AnalyticsPage() {
  const [annualData, setAnnualData] = useState<AnnualData[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("1y");
  const [loading, setLoading] = useState(true);
  const [futuresCurveData, setFuturesCurveData] = useState<FuturesCurvePoint[]>([]);
  const [futuresCurveRange, setFuturesCurveRange] = useState<FuturesRange>("90");

  useEffect(() => {
    fetchAnnualData();
  }, []);

  useEffect(() => {
    fetchHistoricalData(timeRange);
  }, [timeRange]);

  useEffect(() => {
    fetchFuturesCurve(futuresCurveRange);
  }, [futuresCurveRange]);

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

  const fetchFuturesCurve = async (days: FuturesRange) => {
    try {
      const res = await fetch(`/api/analytics?type=futures-curve&days=${days}`);
      const data = await res.json();
      if (data.success) {
        setFuturesCurveData(data.data);
      }
    } catch (error) {
      console.error("Error fetching futures curve:", error);
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

  return (
    <DashboardLayout>
      <Page title="Price Analytics" subtitle="Historical WTI crude oil price analysis (1987-2026)">
        <HistoricalPanel
          data={historicalData}
          loading={loading}
          timeRange={timeRange}
          onRangeChange={setTimeRange}
        />

        <div className={GRID_2}>
          <AnnualPerformancePanel data={annualData} />
          <AnnualAveragePanel data={annualData} />
        </div>

        <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
          <FuturesCurvePanel data={futuresCurveData} range={futuresCurveRange} onRangeChange={setFuturesCurveRange} />

          <Panel title="Annual Statistics" flush>
            <div className={`${TABLE_SCROLL} 2xl:max-h-[440px]`}>
              <table className={TABLE}>
                <thead className={STICKY_HEAD}>
                  <tr>
                    <th className={TH}>Year</th>
                    <th className={TH_NUM}>Avg Price</th>
                    <th className={TH_NUM}>Min</th>
                    <th className={TH_NUM}>Max</th>
                    <th className={TH_NUM}>YoY Change</th>
                    <th className={TH_NUM}>Trading Days</th>
                  </tr>
                </thead>
                <tbody>
                  {[...annualData].reverse().map((d) => (
                    <tr key={d.year} className={TR}>
                      <td className={TD}>
                        <span className="font-medium text-slate-800">{d.year}</span>
                      </td>
                      <td className={TD_NUM}>
                        <span className="text-slate-800">{fmtMoney(d.avgPrice)}</span>
                      </td>
                      <td className={TD_NUM}>{fmtMoney(d.minPrice)}</td>
                      <td className={TD_NUM}>{fmtMoney(d.maxPrice)}</td>
                      <td className={TD_NUM}>
                        <span
                          className={`font-medium ${
                            d.percentChange === null ? "text-slate-400" : d.percentChange >= 0 ? "text-good" : "text-bad"
                          }`}
                        >
                          {d.percentChange !== null
                            ? `${d.percentChange >= 0 ? "+" : ""}${d.percentChange.toFixed(1)}%`
                            : "--"}
                        </span>
                      </td>
                      <td className={TD_NUM}>{d.tradingDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </Page>
    </DashboardLayout>
  );
}
