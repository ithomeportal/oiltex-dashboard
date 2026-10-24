"use client";

import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { ChartLegend } from "@/components/charts/ChartTooltip";
import { SERIES } from "@/components/charts/theme";
import { Panel } from "@/components/ui/Panel";
import { StateBlock } from "@/components/ui/Controls";
import { GRID_2 } from "@/components/ui/styles";
import { fmtDayDate } from "@/lib/format";
import { netAfterLease, toNum, type ArgusPricingRow } from "../_lib";

interface TrendChartsProps {
  rows: readonly ArgusPricingRow[];
  isWtlLease: boolean;
  transport: number;
}

const CHART_HEIGHT = 300;
const NET_UP = SERIES.blue;
const NET_DOWN = SERIES.red;

const xFormatter = (v: string) => {
  const [, m, d] = v.split("-");
  return m && d ? `${parseInt(m, 10)}/${parseInt(d, 10)}` : v;
};
const tooltipLabel = (l: unknown) => fmtDayDate(String(l));
const signed = (v: number, dp: number) => `${v >= 0 ? "+" : ""}${v.toFixed(dp)}`;
const diffValue = (v: unknown) => (typeof v === "number" ? signed(v, 4) : String(v));
const dollarValue = (v: unknown) => (typeof v === "number" ? `$${v.toFixed(2)}` : String(v));

export function TrendCharts({ rows, isWtlLease, transport }: TrendChartsProps) {
  // API returns DESC; charts read oldest → newest.
  const ordered = [...rows].reverse();
  const diffData = ordered.map((r) => ({
    date: r.report_date.split("T")[0],
    cma: toNum(r.cma_diff_daily),
    mid: toNum(r.midland_diff_daily),
  }));
  const netData = ordered.map((r) => ({
    date: r.report_date.split("T")[0],
    net: netAfterLease(r, r.est_net_mtd, isWtlLease, transport),
    cma: toNum(r.nymex_cma_td),
  }));

  const diffCount = diffData.reduce((n, d) => n + (d.cma !== null ? 1 : 0) + (d.mid !== null ? 1 : 0), 0);
  const netCount = netData.reduce((n, d) => n + (d.net !== null ? 1 : 0) + (d.cma !== null ? 1 : 0), 0);
  const validNets = netData.map((d) => d.net).filter((v): v is number => v !== null);
  const trendUp = validNets.length >= 2 && validNets[validNets.length - 1] >= validNets[0];
  const netColor = trendUp ? NET_UP : NET_DOWN;

  return (
    <div className={GRID_2}>
      <Panel
        title="Differentials Trend"
        subtitle="Daily, $/bbl"
        actions={
          <ChartLegend
            items={[
              { label: "CMA Diff Daily", color: SERIES.amber },
              { label: "Midland Diff Daily", color: SERIES.green },
            ]}
          />
        }
      >
        {diffCount < 2 ? (
          <StateBlock kind="empty" height="h-[300px]">Not enough data</StateBlock>
        ) : (
          <TimeSeriesChart
            data={diffData}
            xKey="date"
            height={CHART_HEIGHT}
            series={[
              { key: "cma", label: "CMA Diff Daily", color: SERIES.amber },
              { key: "mid", label: "Midland Diff Daily", color: SERIES.green },
            ]}
            refLines={[{ y: 0 }]}
            xFormatter={xFormatter}
            tooltipLabelFormatter={tooltipLabel}
            yFormatter={(v) => signed(v, 2)}
            valueFormatter={diffValue}
          />
        )}
      </Panel>

      <Panel
        title="Est Net Price Trend (MTD)"
        subtitle="After lease diff, $/bbl"
        actions={
          <ChartLegend
            items={[
              { label: "Est Net (after lease diff)", color: netColor },
              { label: "NYMEX CMA", color: SERIES.amber, dashed: true },
            ]}
          />
        }
      >
        {netCount < 2 ? (
          <StateBlock kind="empty" height="h-[300px]">Not enough data</StateBlock>
        ) : (
          <TimeSeriesChart
            data={netData}
            xKey="date"
            height={CHART_HEIGHT}
            series={[
              { key: "net", label: "Est Net (after lease diff)", color: netColor, kind: "area" },
              { key: "cma", label: "NYMEX CMA", color: SERIES.amber, dashed: true, muted: true, width: 1.5 },
            ]}
            xFormatter={xFormatter}
            tooltipLabelFormatter={tooltipLabel}
            yFormatter={(v) => `$${v.toFixed(2)}`}
            valueFormatter={dollarValue}
          />
        )}
      </Panel>
    </div>
  );
}
