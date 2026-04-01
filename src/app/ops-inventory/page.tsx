"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import type { TicketSummary, OilTicket } from "@/lib/ticket-types";

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

type FilterMode = "month" | "range";
type BreakdownTab = "byWell" | "allTickets";

export default function OpsInventoryOverview() {
  const [summary, setSummary] = useState<TicketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ticketSortAsc, setTicketSortAsc] = useState(true);
  const [expandedWells, setExpandedWells] = useState<ReadonlySet<string>>(new Set());
  const [wellTicketsMap, setWellTicketsMap] = useState<Readonly<Record<string, ReadonlyArray<OilTicket>>>>({});
  const [wellTicketsLoading, setWellTicketsLoading] = useState<ReadonlySet<string>>(new Set());
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>("byWell");
  const [allTickets, setAllTickets] = useState<ReadonlyArray<OilTicket>>([]);
  const [allTicketsLoading, setAllTicketsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setExpandedWells(new Set());
    setWellTicketsMap({});
    setAllTickets([]);
    try {
      const params = new URLSearchParams();
      if (filterMode === "range" && dateFrom && dateTo) {
        params.set("dateFrom", dateFrom);
        params.set("dateTo", dateTo);
      } else {
        params.set("month", month);
      }
      const res = await fetch(`/api/ops-inventory/summary?${params.toString()}`);
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } catch (error) {
      console.error("Error fetching ops inventory data:", error);
    } finally {
      setLoading(false);
    }
  }, [month, filterMode, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const buildTicketParams = useCallback((shipperName: string) => {
    const ticketParams = new URLSearchParams({ shipper: shipperName, limit: "100" });
    if (filterMode === "range" && dateFrom && dateTo) {
      ticketParams.set("dateFrom", dateFrom);
      ticketParams.set("dateTo", dateTo);
    } else {
      const [year, monthNum] = month.split("-").map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      ticketParams.set("dateFrom", `${month}-01`);
      ticketParams.set("dateTo", `${month}-${String(daysInMonth).padStart(2, "0")}`);
    }
    return ticketParams;
  }, [filterMode, dateFrom, dateTo, month]);

  const fetchAllTickets = useCallback(async () => {
    setAllTicketsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (filterMode === "range" && dateFrom && dateTo) {
        params.set("dateFrom", dateFrom);
        params.set("dateTo", dateTo);
      } else {
        const [year, monthNum] = month.split("-").map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        params.set("dateFrom", `${month}-01`);
        params.set("dateTo", `${month}-${String(daysInMonth).padStart(2, "0")}`);
      }
      const res = await fetch(`/api/ops-inventory/tickets?${params.toString()}`);
      const data = await res.json();
      if (data.success) setAllTickets(data.data);
    } catch (error) {
      console.error("Error fetching all tickets:", error);
    } finally {
      setAllTicketsLoading(false);
    }
  }, [filterMode, dateFrom, dateTo, month]);

  useEffect(() => {
    if (breakdownTab === "allTickets") {
      fetchAllTickets();
    }
  }, [breakdownTab, fetchAllTickets]);

  const fetchWellTickets = useCallback(async (shipperName: string) => {
    setWellTicketsLoading((prev) => new Set([...prev, shipperName]));
    try {
      const ticketParams = buildTicketParams(shipperName);
      const res = await fetch(`/api/ops-inventory/tickets?${ticketParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setWellTicketsMap((prev) => ({ ...prev, [shipperName]: data.data }));
      }
    } catch (error) {
      console.error("Error fetching well tickets:", error);
    } finally {
      setWellTicketsLoading((prev) => {
        const next = new Set(prev);
        next.delete(shipperName);
        return next;
      });
    }
  }, [buildTicketParams]);

  const handleWellClick = async (shipperName: string) => {
    if (expandedWells.has(shipperName)) {
      setExpandedWells((prev) => {
        const next = new Set(prev);
        next.delete(shipperName);
        return next;
      });
      return;
    }
    setExpandedWells((prev) => new Set([...prev, shipperName]));
    if (!wellTicketsMap[shipperName]) {
      fetchWellTickets(shipperName);
    }
  };

  const handleExpandAll = () => {
    if (!summary?.wells) return;
    const allNames = summary.wells.map((w) => w.shipper_name);
    setExpandedWells(new Set(allNames));
    const needsFetch = allNames.filter((name) => !wellTicketsMap[name]);
    needsFetch.forEach((name) => fetchWellTickets(name));
  };

  const handleCollapseAll = () => {
    setExpandedWells(new Set());
  };

  const allExpanded = (summary?.wells?.length ?? 0) > 0 && expandedWells.size === (summary?.wells?.length ?? 0);

  const formatBbls = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Calculate transit variance
  const netBbls = summary?.total_net_bbls ?? 0;
  const deliveredBbls = summary?.total_delivered_bbls ?? 0;
  const varianceBbls = netBbls - deliveredBbls;
  const variancePct = netBbls > 0 ? (varianceBbls / netBbls) * 100 : 0;
  const varianceColor =
    varianceBbls === 0
      ? "text-green-600"
      : varianceBbls > 0
        ? "text-red-600"
        : "text-amber-600";
  const varianceBgColor =
    varianceBbls === 0
      ? "bg-green-100"
      : varianceBbls > 0
        ? "bg-red-100"
        : "bg-amber-100";

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">OPs Inventory</h1>
              <p className="text-slate-500 text-sm mt-1">
                Oil transport ticket tracking and barrel reconciliation
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Filter Mode Toggle */}
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  onClick={() => setFilterMode("month")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    filterMode === "month"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setFilterMode("range")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    filterMode === "range"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Custom Range
                </button>
              </div>

              {filterMode === "month" ? (
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
                  />
                  <span className="text-slate-400 text-sm">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
                  />
                </div>
              )}

              <button
                onClick={fetchData}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <SummaryCard
              label="Total Loaded BBLs"
              value={formatBbls(summary?.total_loaded_bbls)}
              icon="loaded"
            />
            <SummaryCard
              label="Net BBLs"
              value={formatBbls(summary?.total_net_bbls)}
              icon="net"
            />
            <SummaryCard
              label="Delivered BBLs"
              value={formatBbls(summary?.total_delivered_bbls)}
              icon="delivered"
            />
            <SummaryCard
              label="Ticket Count"
              value={String(summary?.total_tickets ?? 0)}
              icon="count"
            />
            {/* Transit Variance Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${varianceBgColor} ${varianceColor}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <span className="text-sm text-slate-500">Transit Variance</span>
              </div>
              <p className={`text-2xl font-bold ${varianceColor}`}>
                {formatBbls(varianceBbls)} BBLs
              </p>
              <p className={`text-xs mt-1 ${varianceColor}`}>
                {variancePct.toFixed(2)}% (Net - Delivered)
              </p>
            </div>
          </div>

          {/* Per-Well Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Per-Well Breakdown</h2>
                <div className="flex items-center gap-1 mt-2">
                  <button
                    onClick={() => setBreakdownTab("byWell")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      breakdownTab === "byWell"
                        ? "bg-blue-600 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    By Well
                  </button>
                  <button
                    onClick={() => setBreakdownTab("allTickets")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      breakdownTab === "allTickets"
                        ? "bg-blue-600 text-white"
                        : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    All Tickets
                  </button>
                </div>
              </div>
              {breakdownTab === "byWell" && (summary?.wells?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTicketSortAsc((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ticketSortAsc ? "M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4V4" : "M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"} />
                    </svg>
                    Date {ticketSortAsc ? "Asc" : "Desc"}
                  </button>
                  <button
                    onClick={allExpanded ? handleCollapseAll : handleExpandAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <svg className={`w-4 h-4 transition-transform ${allExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={allExpanded ? "M19 9l-7 7-7-7" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"} />
                    </svg>
                    {allExpanded ? "Collapse All" : "Expand All"}
                  </button>
                </div>
              )}
              {breakdownTab === "allTickets" && allTickets.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTicketSortAsc((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ticketSortAsc ? "M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4V4" : "M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"} />
                    </svg>
                    Date {ticketSortAsc ? "Asc" : "Desc"}
                  </button>
                  <span className="text-sm text-slate-400">{allTickets.length} tickets</span>
                </div>
              )}
            </div>

            {breakdownTab === "byWell" && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-6"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Well / Lease</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Operator</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">County</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">State</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Tickets</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Loaded BBLs</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net BBLs</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Delivered BBLs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {summary?.wells && summary.wells.length > 0 ? (
                    summary.wells.map((well, i) => {
                      const isExpanded = expandedWells.has(well.shipper_name);
                      return (
                        <WellRow
                          key={i}
                          well={well}
                          index={i}
                          isExpanded={isExpanded}
                          isLoading={isExpanded && wellTicketsLoading.has(well.shipper_name)}
                          tickets={isExpanded ? (wellTicketsMap[well.shipper_name] ?? []) : []}
                          sortAsc={ticketSortAsc}
                          formatBbls={formatBbls}
                          onClick={() => handleWellClick(well.shipper_name)}
                        />
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                        No ticket data for {summary?.month ?? month}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            )}

            {breakdownTab === "allTickets" && (
            <div className="overflow-x-auto">
              {allTicketsLoading ? (
                <p className="text-sm text-slate-400 text-center py-8 animate-pulse">Loading tickets...</p>
              ) : allTickets.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Well / Lease</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ticket #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">BOL #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Driver</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Receiver</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Loaded</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Delivered</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">BS&W%</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Gravity</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[...allTickets]
                      .sort((a, b) => {
                        const dateA = a.ticket_date ? new Date(a.ticket_date).getTime() : 0;
                        const dateB = b.ticket_date ? new Date(b.ticket_date).getTime() : 0;
                        return ticketSortAsc ? dateA - dateB : dateB - dateA;
                      })
                      .map((ticket, i) => (
                      <tr key={ticket.id} className={`transition-colors ${i % 2 === 0 ? "bg-white hover:bg-slate-100" : "bg-slate-50 hover:bg-slate-100"}`}>
                        <td className="px-4 py-3 text-sm text-slate-700">{formatTicketDate(ticket.ticket_date)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{ticket.shipper_name ?? "--"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-blue-600">
                          <Link href={`/ops-inventory/tickets/${ticket.id}`} className="hover:underline">
                            {ticket.ticket_number ?? "--"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{ticket.bol_number ?? "--"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{ticket.driver_name ?? "--"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{ticket.receiver_name ?? "--"}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-800">
                          {ticket.loaded_barrels != null ? Number(ticket.loaded_barrels).toFixed(2) : "--"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-800">
                          {ticket.net_barrels != null ? Number(ticket.net_barrels).toFixed(2) : "--"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">
                          {ticket.delivered_bbls != null ? Number(ticket.delivered_bbls).toFixed(2) : "--"}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right ${ticket.bsw_percent != null && Number(ticket.bsw_percent) >= 0.90 ? "font-bold text-red-600" : "text-slate-800"}`}>
                          {ticket.bsw_percent != null ? Number(ticket.bsw_percent).toFixed(2) : "--"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-slate-800">
                          {ticket.obs_gravity != null ? Number(ticket.obs_gravity).toFixed(1) : "--"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ticket.file_url ? (
                            <a
                              href={ticket.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View original PDF"
                              className="inline-flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                                <path d="M8 12h3v1.5H9.5v1H11V16H8v-1.5h1.5v-1H8V12zm4 0h2c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-2v-4zm1.5 1.5v1h.5v-1h-.5zM16 12h2v1.5h-1v.5h1V16h-2v-1.5h1v-.5h-1V12z" />
                              </svg>
                            </a>
                          ) : (
                            <span className="text-slate-300">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-slate-400">
                  No ticket data for {summary?.month ?? month}
                </p>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function WellRow({
  well,
  index,
  isExpanded,
  isLoading,
  tickets,
  sortAsc,
  formatBbls,
  onClick,
}: {
  well: { shipper_name: string; operator: string | null; county: string | null; state: string | null; ticket_count: number; loaded_bbls: number; net_bbls: number; delivered_bbls: number };
  index: number;
  isExpanded: boolean;
  isLoading: boolean;
  tickets: ReadonlyArray<OilTicket>;
  sortAsc: boolean;
  formatBbls: (val: number | null | undefined) => string;
  onClick: () => void;
}) {
  const sortedTickets = [...tickets].sort((a, b) => {
    const dateA = a.ticket_date ? new Date(a.ticket_date).getTime() : 0;
    const dateB = b.ticket_date ? new Date(b.ticket_date).getTime() : 0;
    return sortAsc ? dateA - dateB : dateB - dateA;
  });
  return (
    <>
      <tr
        className={`cursor-pointer transition-colors ${
          isExpanded ? "bg-blue-50" : index % 2 === 0 ? "bg-white hover:bg-slate-100" : "bg-slate-50 hover:bg-slate-100"
        }`}
        onClick={onClick}
      >
        <td className="px-4 py-3 text-sm text-slate-400">
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </td>
        <td className="px-4 py-3 text-sm font-medium text-slate-800">{well.shipper_name}</td>
        <td className="px-4 py-3 text-sm text-slate-600">{well.operator ?? "--"}</td>
        <td className="px-4 py-3 text-sm text-slate-600">{well.county ?? "--"}</td>
        <td className="px-4 py-3 text-sm text-slate-600">{well.state ?? "--"}</td>
        <td className="px-4 py-3 text-sm text-right text-slate-800">{well.ticket_count}</td>
        <td className="px-4 py-3 text-sm text-right text-slate-800">{formatBbls(well.loaded_bbls)}</td>
        <td className="px-4 py-3 text-sm text-right text-slate-800">{formatBbls(well.net_bbls)}</td>
        <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">{formatBbls(well.delivered_bbls)}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <div className="bg-blue-50/50 border-t border-b border-blue-100 px-8 py-4">
              {isLoading ? (
                <p className="text-sm text-slate-400 text-center py-3 animate-pulse">Loading tickets...</p>
              ) : sortedTickets.length > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Ticket #</th>
                      <th className="px-3 py-2 text-left">BOL #</th>
                      <th className="px-3 py-2 text-left">Driver</th>
                      <th className="px-3 py-2 text-left">Receiver</th>
                      <th className="px-3 py-2 text-right">Loaded</th>
                      <th className="px-3 py-2 text-right">Net</th>
                      <th className="px-3 py-2 text-right">Delivered</th>
                      <th className="px-3 py-2 text-right">BS&W%</th>
                      <th className="px-3 py-2 text-right">Gravity</th>
                      <th className="px-3 py-2 text-center">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100">
                    {sortedTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-blue-100/50 transition-colors">
                        <td className="px-3 py-2 text-sm text-slate-700">
                          {formatTicketDate(ticket.ticket_date)}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-blue-600">
                          <Link href={`/ops-inventory/tickets/${ticket.id}`} className="hover:underline">
                            {ticket.ticket_number ?? "--"}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-600">{ticket.bol_number ?? "--"}</td>
                        <td className="px-3 py-2 text-sm text-slate-600">{ticket.driver_name ?? "--"}</td>
                        <td className="px-3 py-2 text-sm text-slate-600">{ticket.receiver_name ?? "--"}</td>
                        <td className="px-3 py-2 text-sm text-right text-slate-800">
                          {ticket.loaded_barrels != null ? Number(ticket.loaded_barrels).toFixed(2) : "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-slate-800">
                          {ticket.net_barrels != null ? Number(ticket.net_barrels).toFixed(2) : "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-medium text-blue-600">
                          {ticket.delivered_bbls != null ? Number(ticket.delivered_bbls).toFixed(2) : "--"}
                        </td>
                        <td className={`px-3 py-2 text-sm text-right ${ticket.bsw_percent != null && Number(ticket.bsw_percent) >= 0.90 ? "font-bold text-red-600" : "text-slate-800"}`}>
                          {ticket.bsw_percent != null ? Number(ticket.bsw_percent).toFixed(2) : "--"}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-slate-800">
                          {ticket.obs_gravity != null ? Number(ticket.obs_gravity).toFixed(1) : "--"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {ticket.file_url ? (
                            <a
                              href={ticket.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View original PDF"
                              className="inline-flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                                <path d="M8 12h3v1.5H9.5v1H11V16H8v-1.5h1.5v-1H8V12zm4 0h2c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-2v-4zm1.5 1.5v1h.5v-1h-.5zM16 12h2v1.5h-1v.5h1V16h-2v-1.5h1v-.5h-1V12z" />
                              </svg>
                            </a>
                          ) : (
                            <span className="text-slate-300">--</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-400 text-center py-3">No tickets found</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  const iconColors: Record<string, string> = {
    loaded: "bg-amber-100 text-amber-600",
    net: "bg-green-100 text-green-600",
    delivered: "bg-blue-100 text-blue-600",
    count: "bg-purple-100 text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[icon] ?? "bg-slate-100"}`}>
          {icon === "loaded" && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          )}
          {icon === "net" && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          )}
          {icon === "delivered" && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {icon === "count" && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          )}
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
