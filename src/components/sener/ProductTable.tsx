"use client";

import { useMemo, useState } from "react";
import type { FuelBalance } from "@/lib/sener/types";
import { G, NO_SORT, num, sortRows, toggleSort, type SortColumn } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { CARD, SortTh, TD } from "./ui";

const DOTS = ["#D4222E", "#1D2F41", "#73787D", "#A7ADB2"];

const COLUMNS: Record<string, SortColumn<FuelBalance>> = {
  fuel: { type: "text", value: (r) => r.fuel },
  customers: { type: "number", value: (r) => r.customers || 0 },
  supply: { type: "number", value: (r) => r.supply },
  demand: { type: "number", value: (r) => r.demand },
  matched: { type: "number", value: (r) => r.matched },
  coverage: { type: "number", value: (r) => (r.demand ? (r.matched / r.demand) * 100 : null) },
};

function Vol({ liters }: { liters: number }) {
  return (
    <>
      {num(liters)} L<div className="text-xs text-slate-500">{num(liters / G)} gal</div>
    </>
  );
}

export default function ProductTable() {
  const { scenario, period } = useSener();
  const [sort, setSort] = useState(NO_SORT);
  const byFuel = useMemo(() => scenario?.byFuel ?? [], [scenario]);
  const colors = useMemo(() => new Map(byFuel.map((r, i) => [r.fuel, DOTS[i % DOTS.length]])), [byFuel]);
  const rows = useMemo(() => sortRows(byFuel, sort, COLUMNS), [byFuel, sort]);
  if (!scenario) return null;
  const onSort = (key: string) => setSort((s) => toggleSort(s, key));

  return (
    <section className={`${CARD} lg:col-span-2`}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Balance by product</h2>
          <p className="text-sm text-slate-500">
            {scenario.hasSharedSupplierPools
              ? "Eligible supply includes shared pools. The same pool can serve several products; these per-product capacities overlap and must not be added. The US supply card counts each pool once."
              : "Fuel products are matched separately. Supply capacities are product-specific."}
          </p>
        </div>
        <span className="text-xs font-semibold tracking-wider text-slate-400">LITERS / {period.unit.toUpperCase()}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <SortTh label="Product" sortKey="fuel" sort={sort} onSort={onSort} />
              <SortTh label="Customers" sortKey="customers" sort={sort} onSort={onSort} numeric />
              <SortTh label="Eligible supply" sortKey="supply" sort={sort} onSort={onSort} numeric />
              <SortTh label="Demand" sortKey="demand" sort={sort} onSort={onSort} numeric />
              <SortTh label="Matchable" sortKey="matched" sort={sort} onSort={onSort} numeric />
              <SortTh label="Coverage" sortKey="coverage" sort={sort} onSort={onSort} numeric />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.map((r) => {
                const low = r.demand > 0 && r.matched / r.demand < 0.999;
                return (
                  <tr key={r.fuel}>
                    <td className={TD}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: colors.get(r.fuel) }} />
                      {r.fuel}
                    </td>
                    <td className={`${TD} text-right`}>
                      {num(r.customers || 0)}
                      <div className="text-xs text-slate-500">active customers</div>
                    </td>
                    <td className={`${TD} text-right`}>
                      <Vol liters={r.supply} />
                      {r.sharedSupply ? <div className="text-xs text-slate-500">Includes shared pool</div> : null}
                    </td>
                    <td className={`${TD} text-right`}>
                      <Vol liters={r.demand} />
                    </td>
                    <td className={`${TD} text-right`}>
                      <Vol liters={r.matched} />
                    </td>
                    <td className={`${TD} text-right`}>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          low ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"
                        }`}
                      >
                        {r.demand ? num((r.matched / r.demand) * 100, 0) + "%" : "No demand"}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  No {period.label.toLowerCase()} volume records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
