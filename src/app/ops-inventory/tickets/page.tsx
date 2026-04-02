"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import type { OilTicket } from "@/lib/ticket-types";

function formatTicketDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

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
    <Suspense fallback={<DashboardLayout><div className="p-8 text-center text-slate-400">Loading...</div></DashboardLayout>}>
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

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Oil Tickets</h1>
              <p className="text-slate-500 text-sm mt-1">
                Search and view all extracted ticket data
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadConsolidatedPdf}
                disabled={consolidating || !activeMonthKey}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                  <path d="M8 12h3v1.5H9.5v1H11V16H8v-1.5h1.5v-1H8V12zm4 0h2c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-2v-4zm1.5 1.5v1h.5v-1h-.5zM16 12h2v1.5h-1v.5h1V16h-2v-1.5h1v-.5h-1V12z" />
                </svg>
                {consolidating ? "Generating..." : "Consolidated PDF"}
              </button>
              <button
                onClick={fetchTickets}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Month Quick Filter */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider mr-1">Month</span>
            {recentMonths.map((mb) => (
              <button
                key={mb.key}
                onClick={() => selectMonth(mb.year, mb.month, mb.key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  activeMonthKey === mb.key
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                {mb.label}
              </button>
            ))}
            {olderMonths.length > 0 && (
              <select
                value={olderMonths.some((m) => m.key === activeMonthKey) ? activeMonthKey : ""}
                onChange={(e) => {
                  const selected = olderMonths.find((m) => m.key === e.target.value);
                  if (selected) selectMonth(selected.year, selected.month, selected.key);
                }}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors cursor-pointer ${
                  olderMonths.some((m) => m.key === activeMonthKey)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-500 border border-slate-300 hover:bg-slate-50"
                }`}
              >
                <option value="" disabled>
                  {olderMonths.some((m) => m.key === activeMonthKey)
                    ? olderMonths.find((m) => m.key === activeMonthKey)?.label
                    : "Older..."}
                </option>
                {olderMonths.map((mb) => (
                  <option key={mb.key} value={mb.key}>
                    {mb.label}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={clearFilters}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                activeMonthKey === ""
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-500 border border-slate-300 hover:bg-slate-50"
              }`}
            >
              All
            </button>
          </div>

          {/* Filter Bar */}
          <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setActiveMonthKey(""); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setActiveMonthKey(""); }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Shipper</label>
                <input
                  type="text"
                  value={shipper}
                  onChange={(e) => setShipper(e.target.value)}
                  placeholder="Well name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Operator</label>
                <input
                  type="text"
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  placeholder="Operator"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">County</label>
                <input
                  type="text"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                  placeholder="County"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="NM"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ticket#, BOL#, driver..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5"
              >
                Clear
              </button>
              <button
                type="submit"
                className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </form>

          {/* Tickets Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ticket #</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">BOL #</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Shipper</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Receiver</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Loaded</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Delivered</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Gravity</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">BS&W%</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Driver</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tickets.length > 0 ? (
                    tickets.map((ticket, i) => (
                      <tr key={ticket.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="px-3 py-3 text-sm text-slate-800">
                          {formatTicketDate(ticket.ticket_date)}
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-blue-600">
                          <Link
                            href={`/ops-inventory/tickets/${ticket.id}`}
                            className="hover:underline"
                          >
                            {ticket.ticket_number ?? "--"}
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600">
                          {ticket.bol_number ?? "--"}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-800 max-w-[200px] truncate">
                          {ticket.shipper_name ?? "--"}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600 max-w-[200px] truncate">
                          {ticket.receiver_name ?? "--"}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-slate-800">
                          {ticket.loaded_barrels != null ? Number(ticket.loaded_barrels).toFixed(2) : "--"}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-slate-800">
                          {ticket.net_barrels != null ? Number(ticket.net_barrels).toFixed(2) : "--"}
                        </td>
                        <td className="px-3 py-3 text-sm text-right font-medium text-blue-600">
                          {ticket.delivered_bbls != null ? Number(ticket.delivered_bbls).toFixed(2) : "--"}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-slate-800">
                          {ticket.obs_gravity != null ? Number(ticket.obs_gravity).toFixed(1) : "--"}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-slate-800">
                          {ticket.bsw_percent != null ? Number(ticket.bsw_percent).toFixed(2) : "--"}
                        </td>
                        <td className="px-3 py-3 text-sm text-slate-600 max-w-[120px] truncate">
                          {ticket.driver_name ?? "--"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {ticket.file_url ? (
                            <a
                              href={ticket.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View original PDF"
                              className="inline-flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                                <path d="M8 12h3v1.5H9.5v1H11V16H8v-1.5h1.5v-1H8V12zm4 0h2c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-2v-4zm1.5 1.5v1h.5v-1h-.5zM16 12h2v1.5h-1v.5h1V16h-2v-1.5h1v-.5h-1V12z" />
                              </svg>
                            </a>
                          ) : (
                            <span className="text-slate-300">--</span>
                          )}
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
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <span className="text-sm text-slate-500">
                Showing {tickets.length} of {total} tickets
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-sm text-slate-600">
                  Page {page} of {totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
