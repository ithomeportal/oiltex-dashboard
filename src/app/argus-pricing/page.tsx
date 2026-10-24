"use client";

import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Field } from "@/components/ui/Controls";
import { BTN_SECONDARY, INPUT, SELECT } from "@/components/ui/styles";
import {
  LEASE_DIFFERENTIALS,
  buildCsvRows,
  csvHeaders,
  formatMonthName,
  getDefaultContractMonth,
  toNum,
  triggerDownload,
  type Lease,
  type PricingApiResponse,
  type ProfitData,
} from "./_lib";
import { KpiRow } from "./_components/KpiRow";
import { FormulaPanel } from "./_components/FormulaPanel";
import { ProfitPanel } from "./_components/ProfitPanel";
import { TrendCharts } from "./_components/TrendCharts";
import { DailyTable } from "./_components/DailyTable";
import { ExhibitATable } from "./_components/ExhibitATable";

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

export default function ArgusPricingPage() {
  const [data, setData] = useState<PricingApiResponse["data"] | null>(null);
  const [meta, setMeta] = useState<PricingApiResponse["meta"] | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getDefaultContractMonth());
  const [selectedLease, setSelectedLease] = useState("ALL");
  const [transportCost, setTransportCost] = useState("2.26");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profitData, setProfitData] = useState<ProfitData | null>(null);

  const activeLease: Lease = selectedLease === "ALL"
    ? { name: "ALL Leases", county: "", diff: 2.26, base: "WTI" as const }
    : LEASE_DIFFERENTIALS.find((l) => l.name === selectedLease) || LEASE_DIFFERENTIALS[1];

  const fetchData = useCallback(
    async (month: string, p: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/argus-pricing?month=${month}&page=${p}&limit=31`
        );
        const json: PricingApiResponse = await res.json();
        if (!json.success) {
          setError(json.error || "Failed to load pricing data");
          return;
        }
        setData(json.data);
        setMeta(json.meta);
        // If we got months back and selected month isn't in the list, switch to first available
        if (
          json.data.months.length > 0 &&
          !json.data.months.includes(month)
        ) {
          setSelectedMonth(json.data.months[0]);
        }
      } catch {
        setError("Failed to load pricing data");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchProfit = useCallback(async (month: string) => {
    try {
      const res = await fetch(`/api/argus-pricing/profit?delivery_month=${month}`);
      const json = await res.json();
      if (json.success) {
        setProfitData(json.data);
      }
    } catch {
      // Profit data is supplementary, don't block on errors
    }
  }, []);

  useEffect(() => {
    fetchData(selectedMonth, page);
    fetchProfit(selectedMonth);
  }, [selectedMonth, page, fetchData, fetchProfit]);

  const downloadCsv = useCallback(async () => {
    if (!selectedMonth) return;
    try {
      const res = await fetch(`/api/argus-pricing?month=${selectedMonth}&page=1&limit=999`);
      const json: PricingApiResponse = await res.json();
      if (!json.success || !json.data.rows.length) return;

      const headers = csvHeaders();
      const dataRows = buildCsvRows(json.data.rows);
      triggerDownload([...headers, ...dataRows].join("\n"), `argus-pricing-${selectedMonth}.csv`);
    } catch {
      // silent
    }
  }, [selectedMonth]);

  const [downloadingAll, setDownloadingAll] = useState(false);

  const months = data?.months;
  const downloadAllCsv = useCallback(async () => {
    if (!months?.length) return;
    setDownloadingAll(true);
    try {
      const allRows: string[] = [];
      const headers = csvHeaders();
      allRows.push(...headers);

      // Fetch each month's data sequentially
      for (const month of months) {
        const res = await fetch(`/api/argus-pricing?month=${month}&page=1&limit=999`);
        const json: PricingApiResponse = await res.json();
        if (!json.success || !json.data.rows.length) continue;

        // Add month separator row
        const fmtMonth = formatMonthName(month);
        allRows.push("");
        allRows.push(`--- ${fmtMonth} ---`);
        allRows.push(...buildCsvRows(json.data.rows));
      }

      triggerDownload(allRows.join("\n"), "argus-pricing-all-months.csv");
    } catch {
      // silent
    } finally {
      setDownloadingAll(false);
    }
  }, [months]);

  const latest = data?.latest;
  const transport = parseFloat(transportCost) || 0;
  const isWtlLease = activeLease.base === "WTL";

  // For WTI leases: Est Net = CMA TD + CMA Diff + Midland Diff - Lease Diff
  // For WTL leases: Est Net = WTL Midland Wtd Avg - Lease Diff
  const latestEstNetMtd = toNum(latest?.est_net_mtd);
  const latestWtlMidland = toNum(latest?.wtl_midland_wtd_avg);
  const estNetMtdMinusTransport = isWtlLease
    ? latestWtlMidland !== null ? latestWtlMidland - transport : null
    : latestEstNetMtd !== null ? latestEstNetMtd - transport : null;

  const onLeaseChange = (value: string) => {
    setSelectedLease(value);
    if (value === "ALL") {
      setTransportCost("2.26");
    } else {
      const lease = LEASE_DIFFERENTIALS.find((l) => l.name === value);
      if (lease) setTransportCost(lease.diff.toFixed(2));
    }
  };

  const toolbar = (
    <>
      <Field label="Contract Month" htmlFor="ap-month" className="w-44">
        <select
          id="ap-month"
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            setPage(1);
          }}
          className={SELECT}
        >
          {data?.months && data.months.length > 0 ? (
            data.months.map((m) => (
              <option key={m} value={m}>
                {formatMonthName(m)}
              </option>
            ))
          ) : (
            <option value={selectedMonth}>{formatMonthName(selectedMonth)}</option>
          )}
        </select>
      </Field>
      <Field label="Lease" htmlFor="ap-lease" className="w-72">
        <select id="ap-lease" value={selectedLease} onChange={(e) => onLeaseChange(e.target.value)} className={SELECT}>
          <option value="ALL">ALL Leases</option>
          {LEASE_DIFFERENTIALS.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name} ({l.base})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Lease Diff ($/bbl)" htmlFor="ap-transport" className="w-32">
        <input
          id="ap-transport"
          type="number"
          step="0.01"
          value={transportCost}
          onChange={(e) => setTransportCost(e.target.value)}
          className={`${INPUT} tabular-nums`}
        />
      </Field>
    </>
  );

  const actions = (
    <>
      <button
        type="button"
        onClick={downloadCsv}
        disabled={!data?.rows?.length}
        className={BTN_SECONDARY}
        title="Download current month as CSV"
      >
        <DownloadIcon />
        Month CSV
      </button>
      <button
        type="button"
        onClick={downloadAllCsv}
        disabled={!data?.months?.length || downloadingAll}
        className={BTN_SECONDARY}
        title="Download all contract months as CSV"
      >
        <DownloadIcon />
        {downloadingAll ? "Exporting…" : "All Months CSV"}
      </button>
    </>
  );

  return (
    <DashboardLayout>
      <Page
        title="Argus Pricing"
        subtitle="Extracted from Argus Americas Crude daily reports"
        toolbar={toolbar}
        actions={actions}
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <KpiRow
          latest={latest}
          activeLease={activeLease}
          isWtlLease={isWtlLease}
          transport={transport}
          estNetMtdMinusTransport={estNetMtdMinusTransport}
        />

        {profitData && <ProfitPanel profitData={profitData} transport={transport} />}

        {latest && (
          <FormulaPanel
            latest={latest}
            activeLease={activeLease}
            isWtlLease={isWtlLease}
            transport={transport}
            estNetMtdMinusTransport={estNetMtdMinusTransport}
          />
        )}

        {data?.rows && data.rows.length >= 2 && (
          <TrendCharts rows={data.rows} isWtlLease={isWtlLease} transport={transport} />
        )}

        <DailyTable
          rows={data?.rows}
          loading={loading}
          selectedMonth={selectedMonth}
          isWtlLease={isWtlLease}
          transport={transport}
          meta={meta}
          page={page}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => (meta ? Math.min(meta.totalPages, p + 1) : p))}
        />

        <ExhibitATable selectedLease={selectedLease} />
      </Page>
    </DashboardLayout>
  );
}
