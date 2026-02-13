"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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

export default function TicketsPage() {
  const [tickets, setTickets] = useState<OilTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [shipper, setShipper] = useState("");
  const [operator, setOperator] = useState("");
  const [county, setCounty] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");

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

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
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
            <button
              onClick={fetchTickets}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
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
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
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
