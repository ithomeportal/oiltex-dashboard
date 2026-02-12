"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import type { TicketSummary, OilTicketUpload } from "@/lib/ticket-types";

export default function OpsInventoryOverview() {
  const [summary, setSummary] = useState<TicketSummary | null>(null);
  const [uploads, setUploads] = useState<OilTicketUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, uploadsRes] = await Promise.all([
        fetch(`/api/ops-inventory/summary?month=${month}`),
        fetch("/api/ops-inventory/uploads"),
      ]);
      const summaryData = await summaryRes.json();
      const uploadsData = await uploadsRes.json();

      if (summaryData.success) setSummary(summaryData.data);
      if (uploadsData.success) setUploads(uploadsData.data.slice(0, 5));
    } catch (error) {
      console.error("Error fetching ops inventory data:", error);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatBbls = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return "0.00";
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
        {status}
      </span>
    );
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Per-Well Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
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
                    summary.wells.map((well, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">{well.shipper_name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{well.operator ?? "--"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{well.county ?? "--"}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{well.state ?? "--"}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-800">{well.ticket_count}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-800">{formatBbls(well.loaded_bbls)}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-800">{formatBbls(well.net_bbls)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">{formatBbls(well.delivered_bbls)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                        No ticket data for {month}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Uploads */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Recent Uploads</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {uploads.length > 0 ? (
                uploads.map((upload) => (
                  <div key={upload.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{upload.filename}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(upload.upload_date).toLocaleString()}
                      </p>
                    </div>
                    {statusBadge(upload.status)}
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-sm text-slate-400">
                  No uploads yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
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
