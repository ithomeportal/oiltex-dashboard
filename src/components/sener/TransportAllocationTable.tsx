"use client";

import { useMemo, useState } from "react";
import { G, NO_SORT, num, sortRows, toggleSort, type SortColumn } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { CARD, SortTh, TD } from "./ui";

interface AllocationRow {
  key: string;
  company: string;
  fuel: string;
  liters: number;
  gallons: number;
}

const COLUMNS: Record<string, SortColumn<AllocationRow>> = {
  company: { type: "text", value: (r) => r.company },
  fuel: { type: "text", value: (r) => r.fuel },
  liters: { type: "number", value: (r) => r.liters },
  gallons: { type: "number", value: (r) => r.gallons },
};

export default function TransportAllocationTable() {
  const { scenario, period } = useSener();
  const [sort, setSort] = useState(NO_SORT);
  const allRows = useMemo<AllocationRow[]>(
    () =>
      (scenario?.transportAllocations ?? []).flatMap((a) => {
        const products = Object.entries(a.byFuel).filter(([, v]) => v > 0);
        return products.length
          ? products.map(([fuel, liters]) => ({ key: `${a.id}:${fuel}`, company: a.company, fuel, liters, gallons: liters / G }))
          : [{ key: `${a.id}:none`, company: a.company, fuel: "No allocated product", liters: 0, gallons: 0 }];
      }),
    [scenario],
  );
  const rows = useMemo(() => sortRows(allRows, sort, COLUMNS), [allRows, sort]);
  const onSort = (key: string) => setSort((s) => toggleSort(s, key));

  return (
    <section className={`${CARD} mt-4`}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Transport allocation by product</h2>
        <p className="text-sm text-slate-500">Shared capacity is allocated once per transporter.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <SortTh label="Company" sortKey="company" sort={sort} onSort={onSort} />
              <SortTh label="Product" sortKey="fuel" sort={sort} onSort={onSort} />
              <SortTh label={`Matched liters / ${period.unit}`} sortKey="liters" sort={sort} onSort={onSort} numeric />
              <SortTh label={`US gallons / ${period.unit}`} sortKey="gallons" sort={sort} onSort={onSort} numeric />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.key}>
                  <td className={TD}>{r.company}</td>
                  <td className={TD}>{r.fuel}</td>
                  <td className={`${TD} text-right`}>{num(r.liters)} L</td>
                  <td className={`${TD} text-right`}>{num(r.gallons)} US gal</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                  Add a transporter to see its product allocation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
