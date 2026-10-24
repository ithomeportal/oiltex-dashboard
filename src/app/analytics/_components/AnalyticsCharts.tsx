"use client";

import type { ReactNode } from "react";
import { Panel } from "@/components/ui/Panel";
import { Segmented, StateBlock } from "@/components/ui/Controls";
import { TimeSeriesChart, type SeriesDef } from "@/components/charts/TimeSeriesChart";
import { BarSeriesChart } from "@/components/charts/BarSeriesChart";
import { ChartLegend } from "@/components/charts/ChartTooltip";
import { SERIES } from "@/components/charts/theme";
import { DASH, fmtMoney, fmtSigned } from "@/lib/format";

export interface AnnualData {
  year: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  tradingDays: number;
  percentChange: number | null;
}

export interface FuturesCurvePoint {
  date: string;
  cl1: number | null;
  cl2: number | null;
  cl3: number | null;
  cl4: number | null;
}

export interface HistoricalPoint {
  date: string;
  price: number;
}

export type TimeRange = "ytd" | "1y" | "5y" | "10y" | "all";
export type FuturesRange = "30" | "90" | "365";

const POSITIVE = "#059669";
const NEGATIVE = "#dc2626";

const TIME_RANGE_OPTIONS = (["ytd", "1y", "5y", "10y", "all"] as const).map((r) => ({
  value: r,
  label: r.toUpperCase(),
}));

const FUTURES_RANGE_OPTIONS = [
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "365", label: "1Y" },
] as const;

const FUTURES_SERIES: readonly SeriesDef[] = [
  { key: "cl1", label: "CL1 (Front)", color: SERIES.blue, width: 2.5 },
  { key: "cl2", label: "CL2", color: SERIES.amber, width: 1.5 },
  { key: "cl3", label: "CL3", color: SERIES.green, width: 1.5 },
  { key: "cl4", label: "CL4 (Back)", color: SERIES.violet, width: 1.5 },
];

const monthYear = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const dollars0 = (v: number) => `$${v.toFixed(0)}`;
const dollars2 = (v: unknown) => (typeof v === "number" ? fmtMoney(v) : String(v));

/** Down-sample long series for render performance (same rule as the old SVG charts). */
function sample<T>(rows: readonly T[], maxPoints: number): T[] {
  const rate = Math.max(1, Math.floor(rows.length / maxPoints));
  return rows.filter((_, i) => i % rate === 0 || i === rows.length - 1);
}

function StatChip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-slate-50 px-2.5 py-1 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 tabular-nums">{children}</span>
    </span>
  );
}

// ---- Historical ------------------------------------------------------------

interface HistoricalPanelProps {
  data: readonly HistoricalPoint[];
  loading: boolean;
  timeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

export function HistoricalPanel({ data, loading, timeRange, onRangeChange }: HistoricalPanelProps) {
  const actions = (
    <Segmented options={TIME_RANGE_OPTIONS} value={timeRange} onChange={onRangeChange} ariaLabel="Time range" />
  );
  if (data.length < 2) {
    return (
      <Panel title="WTI Price History" actions={actions}>
        <StateBlock kind={loading ? "loading" : "empty"} height="h-[380px]">
          {loading ? "Loading..." : "Not enough data to display chart"}
        </StateBlock>
      </Panel>
    );
  }

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const firstPrice = data[0]?.price || 0;
  const lastPrice = data[data.length - 1]?.price || 0;
  const changePct = firstPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  const isPositive = changePct >= 0;
  const color = isPositive ? POSITIVE : NEGATIVE;

  return (
    <Panel title="WTI Price History" actions={actions}>
      <div className="flex flex-wrap gap-2 mb-3">
        <StatChip label="Period">
          {data[0]?.date} to {data[data.length - 1]?.date}
        </StatChip>
        <StatChip label="Change">
          <span className={isPositive ? "text-good" : "text-bad"}>
            {isPositive ? "+" : ""}
            {changePct.toFixed(2)}%
          </span>
        </StatChip>
        <StatChip label="Range">
          ${minPrice.toFixed(2)} - ${maxPrice.toFixed(2)}
        </StatChip>
      </div>
      <TimeSeriesChart
        data={sample(data, 500)}
        xKey="date"
        series={[{ key: "price", label: "WTI", color, kind: "area" }]}
        height={380}
        xFormatter={monthYear}
        tooltipLabelFormatter={(l) => String(l)}
        yFormatter={dollars0}
        valueFormatter={dollars2}
      />
    </Panel>
  );
}

// ---- Futures curve ---------------------------------------------------------

interface FuturesCurvePanelProps {
  data: readonly FuturesCurvePoint[];
  range: FuturesRange;
  onRangeChange: (range: FuturesRange) => void;
}

export function FuturesCurvePanel({ data, range, onRangeChange }: FuturesCurvePanelProps) {
  const actions = (
    <>
      <ChartLegend items={FUTURES_SERIES.map((s) => ({ label: s.label, color: s.color }))} />
      <Segmented options={FUTURES_RANGE_OPTIONS} value={range} onChange={onRangeChange} ariaLabel="Futures range" />
    </>
  );
  const sampled = sample(data, 300);
  const hasValues = sampled.some((d) => [d.cl1, d.cl2, d.cl3, d.cl4].some((v) => v !== null));

  let body: ReactNode;
  if (data.length < 2) {
    body = <StateBlock kind="loading" height="h-80">Loading futures data...</StateBlock>;
  } else if (!hasValues) {
    body = <StateBlock kind="empty" height="h-80">No futures data</StateBlock>;
  } else {
    const latest = data[data.length - 1];
    const latestCl1 = latest?.cl1;
    const latestCl4 = latest?.cl4;
    const spread = latestCl1 != null && latestCl4 != null ? latestCl1 - latestCl4 : null;
    body = (
      <>
        <div className="flex flex-wrap gap-2 mb-3">
          <StatChip label="CL1">{latestCl1 != null ? fmtMoney(latestCl1) : DASH}</StatChip>
          <StatChip label="CL4">{latestCl4 != null ? fmtMoney(latestCl4) : DASH}</StatChip>
          <StatChip label="Spread (CL1-CL4)">
            <span className={spread !== null && spread > 0 ? "text-bad" : "text-good"}>
              {spread !== null ? fmtSigned(spread, 2, "$") : DASH}
            </span>
            {spread !== null && (
              <span className="ml-1 font-normal text-slate-400">{spread > 0 ? "backwardation" : "contango"}</span>
            )}
          </StatChip>
        </div>
        <TimeSeriesChart
          data={sampled}
          xKey="date"
          series={FUTURES_SERIES}
          height={320}
          xFormatter={monthYear}
          tooltipLabelFormatter={(l) => String(l)}
          yFormatter={dollars0}
          valueFormatter={dollars2}
        />
      </>
    );
  }

  return (
    <Panel
      title="NYMEX Futures Curve"
      subtitle="CL1 (front month) through CL4 — shows contango/backwardation structure"
      actions={actions}
    >
      {body}
    </Panel>
  );
}

// ---- Annual bars -----------------------------------------------------------

export function AnnualPerformancePanel({ data }: { data: readonly AnnualData[] }) {
  const withChange = data.filter((d) => d.percentChange !== null);
  return (
    <Panel
      title="Annual Performance"
      subtitle="Year-over-year percentage change in average WTI price. Green = increase, Red = decrease."
      actions={
        <ChartLegend
          items={[
            { label: "Increase", color: POSITIVE },
            { label: "Decrease", color: NEGATIVE },
          ]}
        />
      }
    >
      {withChange.length === 0 ? (
        <StateBlock kind="empty" height="h-80">No annual data</StateBlock>
      ) : (
        <BarSeriesChart
          data={withChange}
          categoryKey="year"
          bars={[{ key: "percentChange", label: "YoY Change", color: POSITIVE }]}
          height={320}
          valueFormatter={(v) => `${v.toFixed(1)}%`}
          colorFor={(row) => ((row.percentChange ?? 0) >= 0 ? POSITIVE : NEGATIVE)}
        />
      )}
    </Panel>
  );
}

export function AnnualAveragePanel({ data }: { data: readonly AnnualData[] }) {
  return (
    <Panel title="Annual Average Price" subtitle="Annual average WTI crude oil price per barrel.">
      {data.length === 0 ? (
        <StateBlock kind="empty" height="h-80">No annual data</StateBlock>
      ) : (
        <BarSeriesChart
          data={data}
          categoryKey="year"
          bars={[{ key: "avgPrice", label: "Avg Price", color: SERIES.blue }]}
          height={320}
          valueFormatter={(v) => fmtMoney(v)}
        />
      )}
    </Panel>
  );
}
