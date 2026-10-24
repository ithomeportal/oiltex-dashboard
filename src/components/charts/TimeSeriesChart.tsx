"use client";

import { useId, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";
import { AXIS_LINE, AXIS_TICK, CURSOR, GRID_STROKE, MARGIN } from "./theme";

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
  /** "area" draws a soft gradient fill under the line. */
  kind?: "line" | "area";
  dashed?: boolean;
  width?: number;
  /** Dim reference series. */
  muted?: boolean;
}

interface TimeSeriesChartProps<Row> {
  data: readonly Row[];
  xKey: keyof Row & string;
  series: readonly SeriesDef[];
  height?: number;
  xFormatter?: (value: string) => string;
  tooltipLabelFormatter?: (label: ReactNode) => ReactNode;
  yFormatter?: (value: number) => string;
  valueFormatter?: (value: unknown) => ReactNode;
  /** Horizontal reference lines, e.g. zero for differentials. */
  refLines?: readonly { y: number; label?: string; color?: string }[];
  yDomain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
  yWidth?: number;
}

/** Responsive line/area chart with hover crosshair + tooltip. */
export function TimeSeriesChart<Row extends object>({
  data,
  xKey,
  series,
  height = 300,
  xFormatter,
  tooltipLabelFormatter,
  yFormatter = (v) => v.toFixed(2),
  valueFormatter,
  refLines = [],
  yDomain = ["auto", "auto"],
  yWidth = 56,
}: TimeSeriesChartProps<Row>) {
  const uid = useId().replace(/:/g, "");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data as unknown as Record<string, unknown>[]} margin={MARGIN}>
        <defs>
          {series
            .filter((s) => s.kind === "area")
            .map((s) => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis
          dataKey={xKey as string}
          tick={AXIS_TICK}
          axisLine={AXIS_LINE}
          tickLine={false}
          tickFormatter={xFormatter}
          minTickGap={28}
        />
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          tickFormatter={yFormatter}
          domain={yDomain}
          width={yWidth}
        />
        <Tooltip
          cursor={CURSOR}
          content={(props) => (
            <ChartTooltip
              active={props.active}
              payload={props.payload as never}
              label={props.label as ReactNode}
              labelFormatter={tooltipLabelFormatter ?? (xFormatter ? (l) => xFormatter(String(l)) : undefined)}
              valueFormatter={valueFormatter ?? ((v) => (typeof v === "number" ? yFormatter(v) : String(v)))}
            />
          )}
        />
        {refLines.map((r) => (
          <ReferenceLine
            key={`${r.y}-${r.label ?? ""}`}
            y={r.y}
            stroke={r.color ?? "#94a3b8"}
            strokeDasharray="4 4"
            label={r.label ? { value: r.label, position: "insideTopRight", fontSize: 11, fill: "#64748b" } : undefined}
          />
        ))}
        {series.map((s) =>
          s.kind === "area" ? (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.width ?? 2}
              fill={`url(#${uid}-${s.key})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.width ?? 2}
              strokeOpacity={s.muted ? 0.45 : 1}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
