"use client";

import type { ReactNode } from "react";

export interface TooltipRow {
  name?: ReactNode;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly TooltipRow[];
  label?: ReactNode;
  labelFormatter?: (label: ReactNode) => ReactNode;
  valueFormatter?: (value: unknown, row: TooltipRow) => ReactNode;
}

/** White card tooltip with colour dots — used as Recharts <Tooltip content>. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg text-xs backdrop-blur">
      {label !== undefined && label !== "" && (
        <p className="mb-1.5 font-semibold text-slate-700">{labelFormatter ? labelFormatter(label) : label}</p>
      )}
      <ul className="space-y-1">
        {payload
          .filter((row) => row.value !== null && row.value !== undefined)
          .map((row, i) => (
            <li key={`${String(row.dataKey ?? i)}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                {row.name}
              </span>
              <span className="font-semibold tabular-nums text-slate-800">
                {valueFormatter ? valueFormatter(row.value, row) : String(row.value)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Small HTML legend for panel headers (keeps the plot area clean). */
export function ChartLegend({ items }: { items: readonly { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-4 border-t-2"
            style={{ borderColor: it.color, borderTopStyle: it.dashed ? "dashed" : "solid" }}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
