"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { BTN_SECONDARY, GRID_2 } from "@/components/ui/styles";
import { ArgusPanels, LEASE_DIFF_WTI, LEASE_DIFF_WTL } from "./_components/ArgusPanels";
import { LaneVolumePanel } from "./_components/LaneVolumePanel";
import { MarketTicker } from "./_components/MarketTicker";
import { TradeMonthBanner } from "./_components/TradeMonthBanner";
import { WtiChartPanel } from "./_components/WtiChartPanel";
import type { ArgusPricingLatest, LivePrices, WellBreakdown } from "./_components/types";

function getLaneMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const options: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${names[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return options;
}

export default function Dashboard() {
  const laneMonthOptions = useMemo(() => getLaneMonthOptions(), []);
  const [prices, setPrices] = useState<LivePrices | null>(null);
  const [argusPricing, setArgusPricing] = useState<ArgusPricingLatest | null>(null);
  const [ticketLanes, setTicketLanes] = useState<WellBreakdown[]>([]);
  const [laneMonth, setLaneMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prices?days=60");
      const data = await res.json();
      if (data.success) {
        setPrices(data.data);
      }
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchArgusPricing = useCallback(async () => {
    try {
      const initRes = await fetch("/api/argus-pricing?month=_");
      const initData = await initRes.json();
      const latestMonth = initData?.data?.months?.[0];
      if (!latestMonth) return;

      const res = await fetch(`/api/argus-pricing?month=${latestMonth}`);
      const data = await res.json();
      if (data.success && data.data.latest) {
        const raw = data.data.latest;
        setArgusPricing({
          nymex_cma_td: raw.nymex_cma_td !== null ? parseFloat(raw.nymex_cma_td) : null,
          cma_diff_mtd: raw.cma_diff_mtd !== null ? parseFloat(raw.cma_diff_mtd) : null,
          midland_diff_mtd: raw.midland_diff_mtd !== null ? parseFloat(raw.midland_diff_mtd) : null,
          est_net_mtd: raw.est_net_mtd !== null ? parseFloat(raw.est_net_mtd) : null,
          wtl_midland_wtd_avg: raw.wtl_midland_wtd_avg !== null ? parseFloat(raw.wtl_midland_wtd_avg) : null,
          report_date: raw.report_date,
          contract_month: raw.contract_month || latestMonth,
        });
      }
    } catch (err) {
      console.error("Error fetching Argus pricing:", err);
    }
  }, []);

  const fetchTicketLanes = useCallback(async (month: string) => {
    try {
      const res = await fetch(`/api/ops-inventory/summary?month=${month}`);
      const json = await res.json();
      if (json.success && json.data?.wells) {
        setTicketLanes(
          json.data.wells.map((w: { shipper_name: string; ticket_count: number; delivered_bbls: number }) => ({
            shipper_name: w.shipper_name,
            ticket_count: w.ticket_count,
            delivered_bbls: w.delivered_bbls,
          }))
        );
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    fetchArgusPricing();
    fetchTicketLanes(laneMonth);
  }, [fetchPrices, fetchArgusPricing, fetchTicketLanes, laneMonth]);

  // Latest market data
  const latestEIA = prices?.eia?.find((p) => p.value !== null);
  const latestFRED = prices?.fred?.find((p) => p.value !== null);
  const latestWTI = latestEIA || latestFRED;
  const latestFutures = prices?.yahooFutures?.find((p) => p.value !== null);
  const latestMidlandDiff = prices?.yahooMidland?.find((p) => p.value !== null);

  const latestNymex = prices?.nymex?.find((p) => p.value !== null);
  const latestChartExport = prices?.chartExport?.find((p) => p.value !== null);
  const latestInvestingCom = prices?.investingCom?.find((p) => p.value !== null);
  const latestSettlement = latestNymex || latestChartExport || latestInvestingCom;

  const spotSource = latestEIA ? "EIA" : (latestFRED ? "FRED" : null);
  const settlementSource = latestNymex ? "NYMEX" : (latestChartExport ? "Chart" : (latestInvestingCom ? "Investing" : null));

  const today = new Date().toISOString().split("T")[0];
  const hasTodayData = !!(
    prices?.yahooFutures?.some((p) => p.date === today) ||
    prices?.yahooMidland?.some((p) => p.date === today)
  );

  // Spot price change
  const spotData = (prices?.eia?.length || 0) > 0 ? prices?.eia : prices?.fred;
  const prevWTI = spotData?.filter((p) => p.value !== null)?.[1];
  const wtiChange = latestWTI?.value && prevWTI?.value ? latestWTI.value - prevWTI.value : 0;
  const wtiChangePct = prevWTI?.value ? (wtiChange / prevWTI.value) * 100 : 0;

  // Argus-derived net prices
  const wtiEstNet = argusPricing?.est_net_mtd !== null && argusPricing?.est_net_mtd !== undefined
    ? argusPricing.est_net_mtd - LEASE_DIFF_WTI
    : null;
  const wtlEstNet = argusPricing?.wtl_midland_wtd_avg !== null && argusPricing?.wtl_midland_wtd_avg !== undefined
    ? argusPricing.wtl_midland_wtd_avg - LEASE_DIFF_WTL
    : null;

  return (
    <DashboardLayout>
      <TradeMonthBanner live={hasTodayData} />
      <Page
        title="Price Dashboard"
        subtitle="WTI market prices, Argus net pricing and delivery volume"
        actions={
          <button
            type="button"
            onClick={() => { fetchPrices(); fetchArgusPricing(); }}
            disabled={loading}
            className={BTN_SECONDARY}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      >
        <MarketTicker
          settlement={latestSettlement}
          settlementSource={settlementSource}
          spot={latestWTI}
          spotSource={spotSource}
          spotChange={wtiChange}
          spotChangePct={wtiChangePct}
          futures={latestFutures}
          midlandDiff={latestMidlandDiff}
        />

        {argusPricing && <ArgusPanels pricing={argusPricing} wtiEstNet={wtiEstNet} wtlEstNet={wtlEstNet} />}

        <div className={GRID_2}>
          <WtiChartPanel spotData={spotData} spotSource={spotSource} argusHouston={prices?.argusHouston} />
          <LaneVolumePanel
            lanes={ticketLanes}
            laneMonth={laneMonth}
            onLaneMonthChange={setLaneMonth}
            monthOptions={laneMonthOptions}
          />
        </div>

        {prices?.fetchedAt && (
          <p className="text-center text-xs text-slate-500 tabular-nums">
            Last updated: {new Date(prices.fetchedAt).toLocaleString()}
          </p>
        )}
      </Page>
    </DashboardLayout>
  );
}
