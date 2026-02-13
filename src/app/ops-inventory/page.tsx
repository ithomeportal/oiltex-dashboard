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

export default function OpsInventoryOverview() {
  const [summary, setSummary] = useState<TicketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expandedWell, setExpandedWell] = useState<string | null>(null);
  const [wellTickets, setWellTickets] = useState<ReadonlyArray<OilTicket>>([]);
  const [wellTicketsLoading, setWellTicketsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setExpandedWell(null);
    setWellTickets([]);
    try {
      const res = await fetch(`/api/ops-inventory/summary?month=${month}`);
      const data = await res.json();
      if (data.success) setSummary(data.data);
    } catch (error) {
      console.error("Error fetching ops inventory data:", error);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleWellClick = async (shipperName: string) => {
    if (expandedWell === shipperName) {
      setExpandedWell(null);
      setWellTickets([]);
      return;
    }

    setExpandedWell(shipperName);
    setWellTicketsLoading(true);

    try {
      const [year, monthNum] = month.split("-").map(Number);
      const daysInMonth = new Date(year, monthNum, 0).getDate();
      const dateFrom = `${month}-01`;
      const dateTo = `${month}-${String(daysInMonth).padStart(2, "0")}`;

      const params = new URLSearchParams({
        shipper: shipperName,
        dateFrom,
        dateTo,
        limit: "100",
      });

      const res = await fetch(`/api/ops-inventory/tickets?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setWellTickets(data.data);
      }
    } catch (error) {
      console.error("Error fetching well tickets:", error);
    } finally {
      setWellTicketsLoading(false);
    }
  };

  const formatBbls = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
              />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
          </div>

          {/* Per-Well Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Per-Well Breakdown</h2>
              <p className="text-xs text-slate-400 mt-1">Click a well to see individual tickets</p>
            </div>
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
                      const isExpanded = expandedWell === well.shipper_name;
                      return (
                        <WellRow
                          key={i}
                          well={well}
                          index={i}
                          isExpanded={isExpanded}
                          isLoading={isExpanded && wellTicketsLoading}
                          tickets={isExpanded ? wellTickets : []}
                          formatBbls={formatBbls}
                          onClick={() => handleWellClick(well.shipper_name)}
                        />
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                        No ticket data for {month}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
  formatBbls,
  onClick,
}: {
  well: { shipper_name: string; operator: string | null; county: string | null; state: string | null; ticket_count: number; loaded_bbls: number; net_bbls: number; delivered_bbls: number };
  index: number;
  isExpanded: boolean;
  isLoading: boolean;
  tickets: ReadonlyArray<OilTicket>;
  formatBbls: (val: number | null | undefined) => string;
  onClick: () => void;
}) {
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
              ) : tickets.length > 0 ? (
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
                      <th className="px-3 py-2 text-right">Gravity</th>
                      <th className="px-3 py-2 text-center">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100">
                    {tickets.map((ticket) => (
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
