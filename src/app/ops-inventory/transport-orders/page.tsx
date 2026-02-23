"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import type { TransportOrder, TransportOrderSummary } from "@/lib/mcleod-db";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  D: { label: "Delivered", color: "bg-green-100 text-green-700" },
  A: { label: "Available", color: "bg-slate-100 text-slate-600" },
  P: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  C: { label: "Completed", color: "bg-green-100 text-green-700" },
};

function formatStatus(status: string | null): { label: string; color: string } {
  if (!status) return { label: "--", color: "bg-slate-100 text-slate-400" };
  return STATUS_MAP[status] ?? { label: status, color: "bg-slate-100 text-slate-600" };
}

function formatDate(dateStr: string | null): string {
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

function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(val);
}

export default function TransportOrdersPage() {
  const [orders, setOrders] = useState<ReadonlyArray<TransportOrder>>([]);
  const [summary, setSummary] = useState<TransportOrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50 });

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      params.set("page", String(meta.page));
      params.set("limit", String(meta.limit));

      const res = await fetch(`/api/ops-inventory/transport-orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.data);
        setSummary(data.summary);
        setMeta(data.meta);
      }
    } catch (error) {
      console.error("Error fetching transport orders:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, status, search, meta.page, meta.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(meta.total / meta.limit);

  const goToPage = (page: number) => {
    setMeta((prev) => ({ ...prev, page }));
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Transport Orders</h1>
              <p className="text-slate-500 text-sm mt-1">
                McLeod transport orders for OILTEX
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="text-sm text-slate-500 mb-1">Total Orders</div>
              <div className="text-2xl font-bold text-slate-800">
                {summary?.total_orders ?? 0}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="text-sm text-slate-500 mb-1">Total Charges</div>
              <div className="text-2xl font-bold text-slate-800">
                {formatCurrency(summary?.total_charges)}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="text-sm text-slate-500 mb-1">Total Carrier Pay</div>
              <div className="text-2xl font-bold text-slate-800">
                {formatCurrency(summary?.total_carrier_pay)}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="text-sm text-slate-500 mb-1">Avg Margin %</div>
              <div className="text-2xl font-bold text-green-600">
                {summary?.avg_margin_pct != null
                  ? `${summary.avg_margin_pct.toFixed(1)}%`
                  : "--"}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); goToPage(1); }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-500">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); goToPage(1); }}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
                />
              </div>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value); goToPage(1); }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="D">Delivered</option>
                <option value="P">In Progress</option>
                <option value="A">Available</option>
                <option value="C">Completed</option>
              </select>
              <input
                type="text"
                placeholder="Search origin/dest/order..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); goToPage(1); }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white flex-1 min-w-[200px]"
              />
              {(dateFrom || dateTo || status || search) && (
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); setStatus(""); setSearch(""); goToPage(1); }}
                  className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Order ID</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Origin</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Destination</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Miles</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Equipment</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Freight</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Other</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Carrier Pay</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-slate-500 uppercase">Margin</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-slate-500 uppercase">Bill Date</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase">RTB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-sm text-slate-400 animate-pulse">
                        Loading transport orders...
                      </td>
                    </tr>
                  ) : orders.length > 0 ? (
                    orders.map((order, i) => {
                      const statusInfo = formatStatus(order.status);
                      return (
                        <tr key={`${order.id}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-3 py-3 text-sm font-medium text-slate-800">{order.id}</td>
                          <td className="px-3 py-3 text-sm text-slate-600">{formatDate(order.ordered_date)}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600">
                            <div className="font-medium">{order.origin_name ?? "--"}</div>
                            <div className="text-xs text-slate-400">
                              {[order.origin_city_name, order.origin_state_id].filter(Boolean).join(", ") || "--"}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600">
                            <div className="font-medium">{order.dest_name ?? "--"}</div>
                            <div className="text-xs text-slate-400">
                              {[order.dest_city_name, order.dest_state_id].filter(Boolean).join(", ") || "--"}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-slate-600">
                            {order.bill_distance != null ? `${Number(order.bill_distance).toFixed(0)} mi` : "--"}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600 max-w-[120px] truncate">
                            {order.equipment_type_descr ?? "--"}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-slate-800">
                            {formatCurrency(order.freight_charge != null ? Number(order.freight_charge) : null)}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-slate-600">
                            {formatCurrency(order.other_charge != null ? Number(order.other_charge) : null)}
                          </td>
                          <td className="px-3 py-3 text-sm text-right font-medium text-slate-800">
                            {formatCurrency(order.total_charge != null ? Number(order.total_charge) : null)}
                          </td>
                          <td className="px-3 py-3 text-sm text-right text-slate-600">
                            {formatCurrency(order.total_carrier_pay != null ? Number(order.total_carrier_pay) : null)}
                          </td>
                          <td className="px-3 py-3 text-sm text-right">
                            {order.margin_amt != null ? (
                              <div>
                                <span className={Number(order.margin_amt) >= 0 ? "text-green-600" : "text-red-600"}>
                                  {formatCurrency(Number(order.margin_amt))}
                                </span>
                                {order.margin_prcnt != null && (
                                  <div className="text-xs text-slate-400">
                                    {Number(order.margin_prcnt).toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            ) : "--"}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-600">{formatDate(order.bill_date)}</td>
                          <td className="px-3 py-3 text-center">
                            {order.ready_to_bill === "Y" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Y</span>
                            ) : order.ready_to_bill === "N" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">N</span>
                            ) : (
                              <span className="text-slate-400 text-sm">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={14} className="px-4 py-8 text-center text-sm text-slate-400">
                        No transport orders found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">
                    Page {meta.page} of {totalPages} ({meta.total} total orders)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(meta.page - 1)}
                      disabled={meta.page <= 1}
                      className="px-3 py-1 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => goToPage(meta.page + 1)}
                      disabled={meta.page >= totalPages}
                      className="px-3 py-1 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
