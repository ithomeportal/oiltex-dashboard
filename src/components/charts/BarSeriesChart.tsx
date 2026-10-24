"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_LINE, AXIS_TICK, GRID_STROKE, MARGIN } from "./theme";

export interface BarDef {
  key: string;
  label: string;
  color: string;
}

interface BarSeriesChartProps<Row> {
  data: readonly Row[];
  categoryKey: keyof Row & string;
  bars: readonly BarDef[];
  height?: number;
  /** "horizontal" = vertical columns (default); "vertical" = horizontal bars (rankings). */
  layout?: "horizontal" | "vertical";
  valueFormatter?: (value: number) => string;
  categoryFormatter?: (value: string) => string;
  /** Per-row colour override for single-series bars (e.g. green up / red down). */
  colorFor?: (row: Row) => string;
  /** Print the value at the end of each bar. */
  showValues?: boolean;
  onBarClick?: (row: Row) => void;
  categoryWidth?: number;
}

/** Responsive bar chart with tooltip; supports column or ranked-bar layouts. */
export function BarSeriesChart<Row extends object>({
  data,
  categoryKey,
  bars,
  height = 300,
  layout = "horizontal",
  valueFormatter = (v) => v.toLocaleString("en-US", { maximumFractionDigits: 2 }),
  categoryFormatter,
  colorFor,
  showValues = false,
  onBarClick,
  categoryWidth = 180,
}: BarSeriesChartProps<Row>) {
  const ranked = layout === "vertical";
  const category = {
    dataKey: categoryKey as string,
    tick: AXIS_TICK,
    axisLine: AXIS_LINE,
    tickLine: false,
    tickFormatter: categoryFormatter,
  };
  const value = {
    tick: AXIS_TICK,
    axisLine: false,
    tickLine: false,
    tickFormatter: valueFormatter,
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data as unknown as Record<string, unknown>[]} layout={layout} margin={{ ...MARGIN, right: showValues ? 64 : MARGIN.right }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={ranked} horizontal={!ranked} />
        {ranked ? (
          <>
            <XAxis type="number" {...value} />
            <YAxis type="category" {...category} width={categoryWidth} interval={0} />
          </>
        ) : (
          <>
            <XAxis type="category" {...category} interval="preserveStartEnd" />
            <YAxis type="number" {...value} width={60} />
          </>
        )}
        <ReferenceLine {...(ranked ? { x: 0 } : { y: 0 })} stroke="#cbd5e1" />
        <Tooltip
          cursor={{ fill: "rgba(148,163,184,0.12)" }}
          content={(props) => (
            <ChartTooltip
              active={props.active}
              payload={props.payload as never}
              label={props.label as ReactNode}
              valueFormatter={(v) => (typeof v === "number" ? valueFormatter(v) : String(v))}
            />
          )}
        />
        {bars.map((b) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.label}
            fill={b.color}
            radius={ranked ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            maxBarSize={ranked ? 26 : 48}
            isAnimationActive={false}
            cursor={onBarClick ? "pointer" : undefined}
            onClick={onBarClick ? (entry) => onBarClick((entry as { payload: Row }).payload) : undefined}
          >
            {colorFor && data.map((row, i) => <Cell key={i} fill={colorFor(row)} />)}
            {showValues && (
              <LabelList
                dataKey={b.key}
                position={ranked ? "right" : "top"}
                formatter={(v: unknown) => (typeof v === "number" ? valueFormatter(v) : "")}
                style={{ fontSize: 12, fill: "#334155", fontWeight: 600 }}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
