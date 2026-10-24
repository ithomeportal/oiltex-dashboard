"use client";

import { useMemo, useState } from "react";
import type { Role } from "@/lib/sener/types";
import {
  ALL_PRODUCTS,
  NO_SORT,
  monthLiters,
  recordStatus,
  reportedLiters,
  sortRegister,
  toggleSort,
  type RegisterEntry,
} from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { pendingCustomerRows } from "./pending-rows";
import RegisterRow from "./RegisterRow";
import { BTN_OUTLINE, CARD, Icon, SortTh, TH } from "./ui";

type Tab = "all" | Role;
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All parties" },
  { id: "supplier", label: "Suppliers" },
  { id: "transport", label: "Transport" },
  { id: "customer", label: "Customers" },
];

export default function CounterpartyRegister() {
  const { workspace, fuel, period, today, openRecord } = useSener();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(NO_SORT);

  const pending = useMemo(() => pendingCustomerRows(workspace), [workspace]);
  const entries: RegisterEntry[] = useMemo(() => [...workspace.records, ...pending], [workspace.records, pending]);
  const volume = (r: RegisterEntry) => reportedLiters(r, period.months, today);
  const status = (r: RegisterEntry) => recordStatus(r, period.months, today);

  const q = query.trim().toLowerCase();
  const filtered = entries.filter(
    (r) =>
      (tab === "all" || r.role === tab) &&
      (tab === "customer" || fuel === ALL_PRODUCTS || r.fuels.includes(fuel) || r.pendingDocument) &&
      [r.company, r.location, r.segment, ...r.fuels].join(" ").toLowerCase().includes(q),
  );
  const rows = sortRegister(filtered, sort, volume, status);
  const relevant = entries.filter((r) => tab === "all" || r.role === tab);
  const savedCount = workspace.records.filter((r) => tab === "all" || r.role === tab).length;
  const onSort = (key: string) => setSort((s) => toggleSort(s, key));

  const summary = `Showing ${rows.length} of ${relevant.length} ${tab === "customer" ? "customer entries" : "entries"} · ${savedCount} registered volume records${
    (tab === "customer" || tab === "all") && pending.length ? ` · ${pending.length} LOI needs volume review` : ""
  }${tab === "customer" ? " · All fuel products" : ""}`;

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            Counterparty register
            <span className="text-xs font-medium bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{entries.length}</span>
          </h2>
          <p className="text-sm text-slate-500">Every volume connects back to a company and a document.</p>
        </div>
        <button type="button" className={`${BTN_OUTLINE} inline-flex items-center gap-2`} onClick={() => openRecord(null)}>
          <Icon name="plus" />
          Add counterparty
        </button>
      </div>
      <div className={`${CARD} !p-0`}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200">
          <div className="flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  if (t.id === "customer") setQuery("");
                }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                  tab === t.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" />
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company or location…"
              aria-label="Search counterparties"
              className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm w-72 max-w-full"
            />
          </label>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <SortTh label="No. / Company / location" sortKey="company" sort={sort} onSort={onSort} />
                <SortTh label="Stage / product" sortKey="stage" sort={sort} onSort={onSort} />
                <SortTh label={`${period.label} volume`} sortKey="volume" sort={sort} onSort={onSort} />
                <SortTh label="Agreement" sortKey="agreement" sort={sort} onSort={onSort} />
                <SortTh label="Status" sortKey="status" sort={sort} onSort={onSort} />
                <th scope="col" className={`${TH} text-left`}>
                  Original document
                </th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length ? (
                rows.map((r, index) => (
                  <RegisterRow
                    key={r.id}
                    record={r}
                    index={index}
                    liters={volume(r)}
                    included={monthLiters(r, today) > 0}
                    status={status(r)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                    No counterparties match this view. Add a record or upload an LOI.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-between gap-2 px-4 py-3 border-t border-slate-200 text-xs text-slate-500">
          <span>{summary}</span>
          <span>LOIs reflect non-binding intent, not firm orders.</span>
        </div>
      </div>
    </section>
  );
}
