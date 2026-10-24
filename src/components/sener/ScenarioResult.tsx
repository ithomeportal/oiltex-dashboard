"use client";

import { useMemo, useState } from "react";
import { G, NO_SORT, num, sortRows, toggleSort, type SortColumn } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { CARD, SortTh, TD } from "./ui";

interface MetricRow {
  metric: string;
  liters: number;
}

const COLUMNS: Record<string, SortColumn<MetricRow>> = {
  metric: { type: "text", value: (r) => r.metric },
  liters: { type: "number", value: (r) => r.liters },
};

export default function ScenarioResult() {
  const { scenario, period } = useSener();
  const [sort, setSort] = useState(NO_SORT);
  const metrics = useMemo<MetricRow[]>(
    () =>
      scenario
        ? [
            { metric: "Uncovered demand", liters: scenario.uncoveredDemand },
            { metric: "Unallocated supply", liters: scenario.unused.supplier },
            { metric: "Supply gap to total demand", liters: scenario.gapsToDemand.supplier },
            { metric: "Transport gap to total demand", liters: scenario.gapsToDemand.transport },
            { metric: "Unused transport capacity", liters: scenario.unused.transport },
          ]
        : [],
    [scenario],
  );
  const rows = useMemo(() => sortRows(metrics, sort, COLUMNS), [metrics, sort]);
  if (!scenario) return null;
  const onSort = (key: string) => setSort((s) => toggleSort(s, key));

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Your scenario balance</h2>
        <span className="text-[11px] font-semibold tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded">WHAT-IF</span>
      </div>
      <div className="text-xs font-semibold tracking-wider text-slate-400">MATCHABLE {period.label.toUpperCase()} VOLUME</div>
      <div className="text-3xl font-bold text-slate-800 mt-1">
        {num(scenario.matchedLiters)} L
        <span className="block text-sm font-normal text-slate-500">{num(scenario.matchedGallons)} US gallons</span>
      </div>
      <div className="flex justify-between text-sm py-3 my-3 border-y border-slate-100">
        <span className="text-slate-600">Customer coverage</span>
        <strong className="text-slate-800">{num(scenario.demandCoverage, 1)}%</strong>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <SortTh label="Metric" sortKey="metric" sort={sort} onSort={onSort} />
              <SortTh label={`Volume / ${period.unit}`} sortKey="liters" sort={sort} onSort={onSort} numeric />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.metric}>
                <td className={TD}>{r.metric}</td>
                <td className={`${TD} text-right`}>
                  {num(r.liters)} L<div className="text-xs text-slate-500">{num(r.liters / G)} US gal</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600">
        Reference:{" "}
        <strong>
          {num(5_000_000 * period.months)} US gal = {num(5_000_000 * G * period.months, 2)} L / {period.unit} (based on 5,000,000 US
          gal / month).
        </strong>{" "}
        All three stages must support the same products. Surplus is not automatically a shortfall.
      </div>
    </section>
  );
}
