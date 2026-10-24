"use client";

import { useMemo } from "react";
import { ChartLegend } from "@/components/charts/ChartTooltip";
import { TimeSeriesChart, type SeriesDef } from "@/components/charts/TimeSeriesChart";
import { SERIES } from "@/components/charts/theme";
import { DeltaChip } from "@/components/ui/KpiTile";
import { Panel } from "@/components/ui/Panel";
import { StateBlock } from "@/components/ui/Controls";
import { fmtDayDate, fmtMoney, fmtPct, fmtSigned } from "@/lib/format";
import type { PriceData } from "./types";

interface ChartRow {
  date: string;
  spot: number;
  houston: number | null;
}

const CHART_HEIGHT = 320;

function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return m && d ? `${parseInt(m, 10)}/${parseInt(d, 10)}` : iso;
}

function StatChip({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2 py-1 text-xs ${className}`}>
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold tabular-nums text-slate-800">{value}</span>
    </span>
  );
}

interface WtiChartPanelProps {
  spotData?: PriceData[];
  spotSource: string | null;
  argusHouston?: PriceData[];
}

export function WtiChartPanel({ spotData, spotSource, argusHouston }: WtiChartPanelProps) {
  const rows = useMemo<ChartRow[]>(() => {
    const houstonByDate = new Map<string, number>();
    (argusHouston || []).forEach((p) => {
      if (p.value !== null) houstonByDate.set(p.date, p.value);
    });
    return (spotData || [])
      .filter((p) => p.value !== null)
      .slice(0, 30)
      .reverse()
      .map((p) => ({ date: p.date, spot: p.value as number, houston: houstonByDate.get(p.date) ?? null }));
  }, [spotData, argusHouston]);

  const hasHouston = (argusHouston?.length ?? 0) > 0;
  const spotLabel = `Spot (${spotSource || "N/A"})`;
  const series: SeriesDef[] = [
    { key: "spot", label: spotLabel, color: SERIES.blue, kind: "area" },
    ...(hasHouston ? [{ key: "houston", label: "WTI Houston (Argus)", color: SERIES.cyan, dashed: true, width: 1.5 }] : []),
  ];
  const legend = series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }));

  return (
    <Panel title="30-Day WTI" subtitle="Daily spot with Argus WTI Houston overlay" actions={<ChartLegend items={legend} />}>
      {rows.length < 2 ? (
        <StateBlock kind="empty" height="h-[320px]">Not enough data to display chart</StateBlock>
      ) : (
        <>
          <TimeSeriesChart
            data={rows}
            xKey="date"
            series={series}
            height={CHART_HEIGHT}
            xFormatter={shortDate}
            tooltipLabelFormatter={(l) => fmtDayDate(String(l))}
            yFormatter={(v) => `$${v.toFixed(0)}`}
            valueFormatter={(v) => fmtMoney(v)}
          />
          <ChartStats rows={rows} />
        </>
      )}
    </Panel>
  );
}

function ChartStats({ rows }: { rows: ChartRow[] }) {
  const priceValues = rows.map((r) => r.spot);
  const allValues = [...priceValues, ...rows.map((r) => r.houston).filter((v): v is number => v !== null)];
  const minPrice = Math.min(...allValues);
  const maxPrice = Math.max(...allValues);
  const firstPrice = priceValues[0];
  const lastPrice = priceValues[priceValues.length - 1];
  const change = lastPrice - firstPrice;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <StatChip label="Days" value={String(rows.length)} />
      <StatChip label="Low" value={fmtMoney(minPrice)} />
      <StatChip label="High" value={fmtMoney(maxPrice)} />
      <StatChip label="Range" value={fmtMoney(maxPrice - minPrice)} />
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
        Change
        <DeltaChip value={change}>
          {fmtSigned(change)} ({fmtPct((change / firstPrice) * 100)})
        </DeltaChip>
      </span>
    </div>
  );
}
