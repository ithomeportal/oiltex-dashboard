"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Panel } from "@/components/ui/Panel";
import { Field, Segmented, StateBlock } from "@/components/ui/Controls";
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SM,
  BTN_SUCCESS,
  INPUT,
  SELECT,
  STICKY_HEAD,
  TABLE,
  TABLE_SCROLL,
  TD,
  TD_NUM,
  TH,
  TH_NUM,
  TR,
} from "@/components/ui/styles";
import { DASH, fmtDayDate, fmtNum } from "@/lib/format";
import type { OilTicket } from "@/lib/ticket-types";
import { PdfIcon, PdfLink, tint } from "../_components/ticketCells";

/** Segmented value meaning "no month selected" (the All button). */
const ALL_KEY = "__all__";

function getMonthRange(year: number, month: number): { from: string; to: string } {
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

interface MonthOption {
  label: string;
  year: number;
  month: number;
  key: string;
}

function getAllMonths(startYear: number, startMonth: number): MonthOption[] {
  const now = new Date();
  const months: MonthOption[] = [];
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const d = new Date(startYear, startMonth, 1);
  while (d <= now) {
    months.push({
      label: `${names[d.getMonth()]} ${d.getFullYear()}`,
      year: d.getFullYear(),
      month: d.getMonth(),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
    d.setMonth(d.getMonth() + 1);
  }
  return months.reverse(); // newest first
}

// Start from Oct 2025 (first data month)
const ALL_MONTHS = getAllMonths(2025, 9);

export default function TicketsPage() {
  return (
    <Suspense fallback={<DashboardLayout><StateBlock kind="loading">Loading...</StateBlock></DashboardLayout>}>
      <TicketsPageContent />
    </Suspense>
  );
}

function TicketsPageContent() {
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<OilTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Default to current month, but allow URL params to override
  const now = new Date();
  const defaultRange = getMonthRange(now.getFullYear(), now.getMonth());
  const urlDateFrom = searchParams.get("dateFrom");
  const urlDateTo = searchParams.get("dateTo");
  const urlShipper = searchParams.get("shipper");

  // Filters
  const [dateFrom, setDateFrom] = useState(urlDateFrom || defaultRange.from);
  const [dateTo, setDateTo] = useState(urlDateTo || defaultRange.to);
  const [activeMonthKey, setActiveMonthKey] = useState(() => {
    if (urlDateFrom) {
      // Extract YYYY-MM from the dateFrom param
      return urlDateFrom.slice(0, 7);
    }
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [shipper, setShipper] = useState(urlShipper || "");
  const [operator, setOperator] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");

  const recentMonths = ALL_MONTHS.slice(0, 3);
  const olderMonths = ALL_MONTHS.slice(3);

  const selectMonth = (year: number, month: number, key: string) => {
    const range = getMonthRange(year, month);
    setDateFrom(range.from);
    setDateTo(range.to);
    setActiveMonthKey(key);
    setPage(1);
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (shipper) params.set("shipper", shipper);
      if (operator) params.set("operator", operator);
      if (county) params.set("county", county);
      if (state) params.set("state", state);
      if (search) params.set("search", search);

      const res = await fetch(`/api/ops-inventory/tickets?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setTickets(data.data);
        setTotal(data.meta.total);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo, shipper, operator, county, state, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const totalPages = Math.ceil(total / limit);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTickets();
  };

  const [consolidating, setConsolidating] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const downloadTicketsSummary = async () => {
    if (!activeMonthKey) return;
    const [year, month] = activeMonthKey.split("-").map(Number);
    const range = getMonthRange(year, month - 1);
    setExportingExcel(true);
    try {
      const res = await fetch(
        `/api/ops-inventory/tickets/summary-excel?dateFrom=${range.from}&dateTo=${range.to}`
      );
      if (!res.ok) {
        let message = "Failed to export tickets summary";
        try { const err = await res.json(); message = err.error || message; } catch {}
        alert(message);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      a.download = `${year}-${monthNames[month - 1]}-tickets.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export tickets summary");
    } finally {
      setExportingExcel(false);
    }
  };

  const downloadConsolidatedPdf = async () => {
    if (!activeMonthKey) return;
    const [year, month] = activeMonthKey.split("-").map(Number);
    const range = getMonthRange(year, month - 1);
    setConsolidating(true);
    try {
      const res = await fetch(
        `/api/ops-inventory/tickets/consolidated-pdf?dateFrom=${range.from}&dateTo=${range.to}`
      );
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to generate consolidated PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OilTex_Tickets_${activeMonthKey}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate consolidated PDF");
    } finally {
      setConsolidating(false);
    }
  };

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setActiveMonthKey("");
    setShipper("");
    setOperator("");
    setCounty("");
    setState("");
    setSearch("");
    setPage(1);
  };

  const olderActive = olderMonths.find((m) => m.key === activeMonthKey);
  const segmentValue = activeMonthKey === "" ? ALL_KEY : olderActive ? "" : activeMonthKey;
  const monthOptions = [
    ...recentMonths.map((m) => ({ value: m.key, label: m.label })),
    { value: ALL_KEY, label: "All" },
  ];
  const onMonthSegment = (key: string) => {
    if (key === ALL_KEY) {
      clearFilters();
      return;
    }
    const selected = recentMonths.find((m) => m.key === key);
    if (selected) selectMonth(selected.year, selected.month, selected.key);
  };

  const actions = (
    <>
      <button
        type="button"
        onClick={downloadTicketsSummary}
        disabled={exportingExcel || !activeMonthKey}
        className={BTN_SUCCESS}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
          <path d="M8 13h8v1.5H8V13zm0 3h6v1.5H8V16zm0-6h8v1.5H8V10z" />
        </svg>
        {exportingExcel ? "Exporting..." : "Tickets Summary"}
      </button>
      <button
        type="button"
        onClick={downloadConsolidatedPdf}
        disabled={consolidating || !activeMonthKey}
        className={BTN_DANGER}
      >
        <PdfIcon />
        {consolidating ? "Generating..." : "Consolidated PDF"}
      </button>
      <button type="button" onClick={fetchTickets} disabled={loading} className={BTN_SECONDARY}>
        {loading ? "Loading..." : "Refresh"}
      </button>
    </>
  );

  const toolbar = (
    <>
      <Field label="Month">
        <Segmented options={monthOptions} value={segmentValue} onChange={onMonthSegment} ariaLabel="Month quick filter" />
      </Field>
      {olderMonths.length > 0 && (
        <Field label="Older months" htmlFor="tickets-older" className="w-40">
          <select
            id="tickets-older"
            value={olderActive ? activeMonthKey : ""}
            onChange={(e) => {
              const selected = olderMonths.find((m) => m.key === e.target.value);
              if (selected) selectMonth(selected.year, selected.month, selected.key);
            }}
            className={`${SELECT} cursor-pointer ${olderActive ? "border-blue-500 ring-2 ring-blue-500/30 font-medium" : ""}`}
          >
            <option value="" disabled>
              {olderActive ? olderActive.label : "Older..."}
            </option>
            {olderMonths.map((mb) => (
              <option key={mb.key} value={mb.key}>
                {mb.label}
              </option>
            ))}
          </select>
        </Field>
      )}
    </>
  );

  return (
    <DashboardLayout>
      <Page title="Oil Tickets" subtitle="Search and view all extracted ticket data" actions={actions} toolbar={toolbar}>
        <Panel title="Filters">
          <form onSubmit={handleSearch}>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              <Field label="From" htmlFor="tf-from">
                <input
                  id="tf-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setActiveMonthKey(""); }}
                  className={INPUT}
                />
              </Field>
              <Field label="To" htmlFor="tf-to">
                <input
                  id="tf-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setActiveMonthKey(""); }}
                  className={INPUT}
                />
              </Field>
              <Field label="Shipper" htmlFor="tf-shipper">
                <input id="tf-shipper" type="text" value={shipper} onChange={(e) => setShipper(e.target.value)} placeholder="Well name" className={INPUT} />
              </Field>
              <Field label="Operator" htmlFor="tf-operator">
                <input id="tf-operator" type="text" value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Operator" className={INPUT} />
              </Field>
              <Field label="County" htmlFor="tf-county">
                <input id="tf-county" type="text" value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County" className={INPUT} />
              </Field>
              <Field label="State" htmlFor="tf-state">
                <input id="tf-state" type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="NM" className={INPUT} />
              </Field>
              <Field label="Search" htmlFor="tf-search">
                <input id="tf-search" type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ticket#, BOL#, driver..." className={INPUT} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" onClick={clearFilters} className={BTN_SECONDARY}>
                Clear
              </button>
              <button type="submit" className={BTN_PRIMARY}>
                Search
              </button>
            </div>
          </form>
        </Panel>

        <Panel flush>
          <div className={TABLE_SCROLL}>
            <table className={TABLE}>
              <thead className={STICKY_HEAD}>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Ticket #</th>
                  <th className={TH}>BOL #</th>
                  <th className={TH}>Shipper</th>
                  <th className={TH}>Receiver</th>
                  <th className={TH_NUM}>Loaded</th>
                  <th className={TH_NUM}>Net</th>
                  <th className={TH_NUM}>Delivered</th>
                  <th className={TH_NUM}>Gravity</th>
                  <th className={TH_NUM}>BS&amp;W%</th>
                  <th className={TH}>Driver</th>
                  <th className={`${TH} text-center`}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length > 0 ? (
                  tickets.map((ticket) => (
                    <tr key={ticket.id} className={TR}>
                      <td className={tint(TD, "text-slate-800")}>{fmtDayDate(ticket.ticket_date)}</td>
                      <td className={tint(TD, "font-medium text-blue-600")}>
                        <Link href={`/ops-inventory/tickets/${ticket.id}`} className="hover:underline">
                          {ticket.ticket_number ?? DASH}
                        </Link>
                      </td>
                      <td className={tint(TD, "text-slate-600")}>{ticket.bol_number ?? DASH}</td>
                      <td
                        className={`${tint(TD, "text-slate-800")} max-w-[360px] truncate`}
                        title={ticket.shipper_name ?? undefined}
                      >
                        {ticket.shipper_name ?? DASH}
                      </td>
                      <td
                        className={`${tint(TD, "text-slate-600")} max-w-[360px] truncate`}
                        title={ticket.receiver_name ?? undefined}
                      >
                        {ticket.receiver_name ?? DASH}
                      </td>
                      <td className={tint(TD_NUM, "text-slate-800")}>{fmtNum(ticket.loaded_barrels, 2)}</td>
                      <td className={tint(TD_NUM, "text-slate-800")}>{fmtNum(ticket.net_barrels, 2)}</td>
                      <td className={tint(TD_NUM, "font-medium text-blue-600")}>{fmtNum(ticket.delivered_bbls, 2)}</td>
                      <td className={tint(TD_NUM, "text-slate-800")}>{fmtNum(ticket.obs_gravity, 1)}</td>
                      <td className={tint(TD_NUM, "text-slate-800")}>{fmtNum(ticket.bsw_percent, 2)}</td>
                      <td
                        className={`${tint(TD, "text-slate-600")} max-w-[240px] truncate`}
                        title={ticket.driver_name ?? undefined}
                      >
                        {ticket.driver_name ?? DASH}
                      </td>
                      <td className={`${TD} text-center`}>
                        <PdfLink url={ticket.file_url} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-sm text-slate-400">
                      {loading ? "Loading tickets..." : "No tickets found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 bg-slate-50 border-t border-line flex flex-wrap justify-between items-center gap-2">
            <span className="text-sm text-slate-500 tabular-nums">
              Showing {tickets.length} of {total} tickets
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={BTN_SM}
              >
                Previous
              </button>
              <span className="px-2 text-sm text-slate-600 tabular-nums">
                Page {page} of {totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={BTN_SM}
              >
                Next
              </button>
            </div>
          </div>
        </Panel>
      </Page>
    </DashboardLayout>
  );
}
