"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Panel } from "@/components/ui/Panel";
import { KpiTile } from "@/components/ui/KpiTile";
import { Field, StateBlock } from "@/components/ui/Controls";
import {
  TABLE_SCROLL,
  TABLE,
  STICKY_HEAD,
  TH,
  TH_NUM,
  TD,
  TD_NUM,
  TR,
  INPUT,
  SELECT,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SM,
  KPI_GRID_4,
} from "@/components/ui/styles";
import { DASH, fmtDayDate, fmtMoney, fmtNum, toNum } from "@/lib/format";
import type { TransportOrder, TransportOrderSummary } from "@/lib/mcleod-db";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  D: { label: "Delivered", color: "bg-green-100 text-green-700" },
  A: { label: "Available", color: "bg-slate-100 text-slate-600" },
  P: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
  C: { label: "Completed", color: "bg-green-100 text-green-700" },
};

const COLUMN_COUNT = 14;
const PILL = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";

function formatStatus(status: string | null): { label: string; color: string } {
  if (!status) return { label: DASH, color: "bg-slate-100 text-slate-400" };
  return STATUS_MAP[status] ?? { label: status, color: "bg-slate-100 text-slate-600" };
}

function cityState(city: string | null, state: string | null): string {
  return [city, state].filter(Boolean).join(", ") || DASH;
}

function LocationCell({ name, city, state }: { name: string | null; city: string | null; state: string | null }) {
  const place = cityState(city, state);
  return (
    <td className={TD}>
      <div className="font-medium text-slate-800 max-w-[320px] truncate" title={name ?? undefined}>
        {name ?? DASH}
      </div>
      <div className="text-xs text-slate-500 max-w-[320px] truncate" title={place}>
        {place}
      </div>
    </td>
  );
}

function OrderRow({ order }: { order: TransportOrder }) {
  const statusInfo = formatStatus(order.status);
  const margin = toNum(order.margin_amt);
  const miles = toNum(order.bill_distance);
  return (
    <tr className={TR}>
      <td className={`${TD} font-medium text-slate-800`}>{order.id}</td>
      <td className={TD}>{fmtDayDate(order.ordered_date)}</td>
      <td className={`${TD} text-center`}>
        <span className={`${PILL} ${statusInfo.color}`}>{statusInfo.label}</span>
      </td>
      <LocationCell name={order.origin_name} city={order.origin_city_name} state={order.origin_state_id} />
      <LocationCell name={order.dest_name} city={order.dest_city_name} state={order.dest_state_id} />
      <td className={TD_NUM}>{miles != null ? `${fmtNum(miles, 0)} mi` : DASH}</td>
      <td className={`${TD} max-w-[260px] truncate`} title={order.equipment_type_descr ?? undefined}>
        {order.equipment_type_descr ?? DASH}
      </td>
      <td className={`${TD_NUM} text-slate-800`}>{fmtMoney(order.freight_charge)}</td>
      <td className={TD_NUM}>{fmtMoney(order.other_charge)}</td>
      <td className={`${TD_NUM} font-semibold text-slate-800`}>{fmtMoney(order.total_charge)}</td>
      <td className={TD_NUM}>{fmtMoney(order.total_carrier_pay)}</td>
      <td className={TD_NUM}>
        {margin != null ? (
          <div>
            <span className={margin >= 0 ? "text-good" : "text-bad"}>{fmtMoney(margin)}</span>
            {order.margin_prcnt != null && (
              <div className="text-xs text-slate-500">{fmtNum(order.margin_prcnt, 1)}%</div>
            )}
          </div>
        ) : (
          DASH
        )}
      </td>
      <td className={TD}>{fmtDayDate(order.bill_date)}</td>
      <td className={`${TD} text-center`}>
        {order.ready_to_bill === "Y" ? (
          <span className={`${PILL} bg-green-100 text-green-700`}>Y</span>
        ) : order.ready_to_bill === "N" ? (
          <span className={`${PILL} bg-red-100 text-red-700`}>N</span>
        ) : (
          <span className="text-slate-400">{DASH}</span>
        )}
      </td>
    </tr>
  );
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

  const hasFilters = Boolean(dateFrom || dateTo || status || search);

  const toolbar = (
    <>
      <Field label="From">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); goToPage(1); }}
          className={INPUT}
        />
      </Field>
      <Field label="To">
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); goToPage(1); }}
          className={INPUT}
        />
      </Field>
      <Field label="Status">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); goToPage(1); }}
          className={SELECT}
        >
          <option value="">All Statuses</option>
          <option value="D">Delivered</option>
          <option value="P">In Progress</option>
          <option value="A">Available</option>
          <option value="C">Completed</option>
        </select>
      </Field>
      <Field label="Search" className="flex-1 min-w-[240px]">
        <input
          type="text"
          placeholder="Search origin/dest/order..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); goToPage(1); }}
          className={INPUT}
        />
      </Field>
      {hasFilters && (
        <button
          onClick={() => { setDateFrom(""); setDateTo(""); setStatus(""); setSearch(""); goToPage(1); }}
          className={BTN_SECONDARY}
        >
          Clear
        </button>
      )}
    </>
  );

  return (
    <DashboardLayout>
      <Page
        title="Transport Orders"
        subtitle="McLeod transport orders for OILTEX"
        actions={
          <button onClick={fetchData} disabled={loading} className={BTN_PRIMARY}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        }
        toolbar={toolbar}
      >
        {/* Summary */}
        <div className={KPI_GRID_4}>
          <KpiTile label="Total Orders" value={fmtNum(summary?.total_orders ?? 0, 0)} />
          <KpiTile label="Total Charges" value={fmtMoney(summary?.total_charges)} />
          <KpiTile label="Total Carrier Pay" value={fmtMoney(summary?.total_carrier_pay)} />
          <KpiTile
            label="Avg Margin %"
            tone="good"
            value={summary?.avg_margin_pct != null ? `${fmtNum(summary.avg_margin_pct, 1)}%` : DASH}
          />
        </div>

        {/* Table */}
        <Panel flush>
          <div className={TABLE_SCROLL}>
            <table className={TABLE}>
              <thead className={STICKY_HEAD}>
                <tr>
                  <th className={TH}>Order ID</th>
                  <th className={TH}>Date</th>
                  <th className={`${TH} text-center`}>Status</th>
                  <th className={TH}>Origin</th>
                  <th className={TH}>Destination</th>
                  <th className={TH_NUM}>Miles</th>
                  <th className={TH}>Equipment</th>
                  <th className={TH_NUM}>Freight</th>
                  <th className={TH_NUM}>Other</th>
                  <th className={TH_NUM}>Total</th>
                  <th className={TH_NUM}>Carrier Pay</th>
                  <th className={TH_NUM}>Margin</th>
                  <th className={TH}>Bill Date</th>
                  <th className={`${TH} text-center`}>RTB</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COLUMN_COUNT}>
                      <StateBlock kind="loading">Loading transport orders...</StateBlock>
                    </td>
                  </tr>
                ) : orders.length > 0 ? (
                  orders.map((order, i) => <OrderRow key={`${order.id}-${i}`} order={order} />)
                ) : (
                  <tr>
                    <td colSpan={COLUMN_COUNT}>
                      <StateBlock kind="empty">No transport orders found</StateBlock>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-between items-center gap-2 px-4 py-2.5 bg-slate-50 border-t border-line">
              <span className="text-sm text-slate-500 tabular-nums">
                Page {meta.page} of {totalPages} ({meta.total} total orders)
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => goToPage(meta.page - 1)} disabled={meta.page <= 1} className={BTN_SM}>
                  Previous
                </button>
                <button onClick={() => goToPage(meta.page + 1)} disabled={meta.page >= totalPages} className={BTN_SM}>
                  Next
                </button>
              </div>
            </div>
          )}
        </Panel>
      </Page>
    </DashboardLayout>
  );
}
