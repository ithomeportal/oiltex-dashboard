"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Panel } from "@/components/ui/Panel";
import { KpiTile, type Tone } from "@/components/ui/KpiTile";
import { Field, Segmented } from "@/components/ui/Controls";
import { BTN_PRIMARY, BTN_SM, INPUT, KPI_GRID_5 } from "@/components/ui/styles";
import type { TicketSummary, OilTicket } from "@/lib/ticket-types";
import { WellBreakdownTable } from "./_components/WellBreakdownTable";
import { AllTicketsTable } from "./_components/AllTicketsTable";
import { KpiIcon } from "./_components/KpiIcon";

const FILTER_MODES = [
  { value: "month", label: "Month" },
  { value: "range", label: "Custom Range" },
] as const;

const BREAKDOWN_TABS = [
  { value: "byWell", label: "By Well" },
  { value: "allTickets", label: "All Tickets" },
] as const;

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
  const varianceTone: Tone = varianceBbls === 0 ? "good" : varianceBbls > 0 ? "bad" : "warn";

  const emptyLabel = `No ticket data for ${summary?.month ?? month}`;
  const wells = summary?.wells ?? [];

  const sortButton = (
    <button type="button" onClick={() => setTicketSortAsc((prev) => !prev)} className={BTN_SM}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ticketSortAsc ? "M3 4h13M3 8h9m-9 4h6m4 0l4 4m0 0l4-4m-4 4V4" : "M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"} />
      </svg>
      Date {ticketSortAsc ? "Asc" : "Desc"}
    </button>
  );

  const toolbar = (
    <>
      <Field label="Period">
        <Segmented options={FILTER_MODES} value={filterMode} onChange={setFilterMode} ariaLabel="Period mode" />
      </Field>
      {filterMode === "month" ? (
        <Field label="Month" htmlFor="ops-month" className="w-44">
          <input id="ops-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={INPUT} />
        </Field>
      ) : (
        <>
          <Field label="From" htmlFor="ops-from" className="w-44">
            <input id="ops-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={INPUT} />
          </Field>
          <Field label="To" htmlFor="ops-to" className="w-44">
            <input id="ops-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={INPUT} />
          </Field>
        </>
      )}
      <button type="button" onClick={fetchData} disabled={loading} className={BTN_PRIMARY}>
        {loading ? "Loading..." : "Refresh"}
      </button>
    </>
  );

  const breakdownActions = (
    <>
      <Segmented options={BREAKDOWN_TABS} value={breakdownTab} onChange={setBreakdownTab} ariaLabel="Breakdown view" />
      {breakdownTab === "byWell" && wells.length > 0 && (
        <>
          {sortButton}
          <button
            type="button"
            onClick={allExpanded ? handleCollapseAll : handleExpandAll}
            className={`${BTN_SM} text-blue-700`}
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${allExpanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={allExpanded ? "M19 9l-7 7-7-7" : "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"} />
            </svg>
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
        </>
      )}
      {breakdownTab === "allTickets" && allTickets.length > 0 && (
        <>
          {sortButton}
          <span className="text-sm text-slate-500 tabular-nums">{allTickets.length} tickets</span>
        </>
      )}
    </>
  );

  return (
    <DashboardLayout>
      <Page
        title="OPs Inventory"
        subtitle="Oil transport ticket tracking and barrel reconciliation"
        toolbar={toolbar}
      >
        <div className={KPI_GRID_5}>
          <KpiTile label="Total Loaded BBLs" value={formatBbls(summary?.total_loaded_bbls)} icon={<KpiIcon kind="loaded" />} />
          <KpiTile label="Net BBLs" value={formatBbls(summary?.total_net_bbls)} icon={<KpiIcon kind="net" />} />
          <KpiTile label="Delivered BBLs" value={formatBbls(summary?.total_delivered_bbls)} icon={<KpiIcon kind="delivered" />} />
          <KpiTile label="Ticket Count" value={String(summary?.total_tickets ?? 0)} icon={<KpiIcon kind="count" />} />
          <KpiTile
            label="Transit Variance"
            value={`${formatBbls(varianceBbls)} BBLs`}
            sub={<span className={varianceTone === "good" ? "text-good" : varianceTone === "bad" ? "text-bad" : "text-warn"}>{variancePct.toFixed(2)}% (Net - Delivered)</span>}
            hint="Net BBLs minus Delivered BBLs for the period"
            tone={varianceTone}
            icon={<KpiIcon kind="variance" />}
          />
        </div>

        <Panel title="Per-Well Breakdown" actions={breakdownActions} flush>
          {breakdownTab === "byWell" ? (
            <WellBreakdownTable
              wells={wells}
              expandedWells={expandedWells}
              loadingWells={wellTicketsLoading}
              ticketsByWell={wellTicketsMap}
              sortAsc={ticketSortAsc}
              emptyLabel={emptyLabel}
              formatBbls={formatBbls}
              onToggle={handleWellClick}
            />
          ) : (
            <AllTicketsTable tickets={allTickets} loading={allTicketsLoading} sortAsc={ticketSortAsc} emptyLabel={emptyLabel} />
          )}
        </Panel>
      </Page>
    </DashboardLayout>
  );
}
