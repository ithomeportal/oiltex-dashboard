import Link from "next/link";
import type { ReactNode } from "react";
import { Panel } from "@/components/ui/Panel";
import { GRID_2 } from "@/components/ui/styles";
import { fmtMoney, fmtSigned } from "@/lib/format";
import type { ArgusPricingLatest } from "./types";

// Lease differentials from Exhibit A
export const LEASE_DIFF_WTI = 2.26; // highest contractual rate
export const LEASE_DIFF_WTL = 2.26;

function formatContractMonth(month: string): string {
  const [year, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(m, 10) - 1]} ${year}`;
}

function formatReportDate(reportDate: string): string {
  if (!reportDate) return "N/A";
  return new Date(reportDate.split("T")[0] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Row({ label, value, tone = "text-slate-800" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}

function EstNet({ value }: { value: number | null }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
      <span className="text-sm font-semibold text-blue-900">Est. Net Price</span>
      <span className="text-2xl font-bold tracking-tight tabular-nums text-blue-700">{fmtMoney(value)}</span>
    </div>
  );
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${className}`}>{children}</span>;
}

interface ArgusPanelsProps {
  pricing: ArgusPricingLatest;
  wtiEstNet: number | null;
  wtlEstNet: number | null;
}

export function ArgusPanels({ pricing, wtiEstNet, wtlEstNet }: ArgusPanelsProps) {
  const subtitle = `Argus ACR · ${formatContractMonth(pricing.contract_month)} delivery · as of ${formatReportDate(pricing.report_date)}`;
  const detailLink = (
    <Link href="/argus-pricing" className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
      Detail View &rarr;
    </Link>
  );

  return (
    <div className={GRID_2}>
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            WTI Pricing <Badge className="bg-amber-50 text-amber-700">5 Leases</Badge>
          </span>
        }
        subtitle={subtitle}
        actions={detailLink}
      >
        <Row label="NYMEX CMA TD" value={fmtMoney(pricing.nymex_cma_td)} />
        <Row label="CMA Diff MTD" value={fmtSigned(pricing.cma_diff_mtd, 4)} />
        <Row label="Midland Diff MTD" value={fmtSigned(pricing.midland_diff_mtd, 4)} />
        <Row label="Lease Diff (Exhibit A)" value={`-$${LEASE_DIFF_WTI.toFixed(2)}`} tone="text-bad" />
        <EstNet value={wtiEstNet} />
      </Panel>

      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            WTL Midland <Badge className="bg-emerald-50 text-emerald-700">GREEN WAVE</Badge>
          </span>
        }
        subtitle={subtitle}
        actions={detailLink}
      >
        <Row label="WTL Midland Wtd Avg" value={fmtMoney(pricing.wtl_midland_wtd_avg)} />
        <Row label="Lease Diff (Exhibit A)" value={`-$${LEASE_DIFF_WTL.toFixed(2)}`} tone="text-bad" />
        <EstNet value={wtlEstNet} />
        <p className="mt-3 text-xs text-slate-500">No oil hauled from this lease yet</p>
      </Panel>
    </div>
  );
}
