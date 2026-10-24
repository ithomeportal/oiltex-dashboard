import { Panel } from "@/components/ui/Panel";
import { DASH, fmtDayDate } from "@/lib/format";
import { formatDiff, formatDollar, formatPrice, type ArgusPricingRow, type Lease } from "../_lib";

interface FormulaPanelProps {
  latest: ArgusPricingRow;
  activeLease: Lease;
  isWtlLease: boolean;
  transport: number;
  estNetMtdMinusTransport: number | null;
}

function Term({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <span className="whitespace-nowrap">
      {label} <span className={`font-semibold ${className}`}>{value}</span>
    </span>
  );
}

export function FormulaPanel({ latest, activeLease, isWtlLease, transport, estNetMtdMinusTransport }: FormulaPanelProps) {
  const result = estNetMtdMinusTransport !== null ? `$${formatPrice(estNetMtdMinusTransport)}` : DASH;
  const leaseDiff = `$${transport.toFixed(2)}`;
  return (
    <Panel
      title={`Pricing Formula — ${activeLease.name} (${activeLease.base})`}
      subtitle={`As of ${latest.report_date ? fmtDayDate(latest.report_date) : "latest"}`}
    >
      <div className="font-mono text-sm text-slate-600 tabular-nums flex flex-wrap gap-x-4 gap-y-1">
        {isWtlLease ? (
          <Term label="WTL Midland Wtd Avg:" value={formatDollar(latest.wtl_midland_wtd_avg)} className="text-emerald-700" />
        ) : (
          <>
            <Term label="NYMEX CMA TD:" value={formatDollar(latest.nymex_cma_td)} className="text-amber-700" />
            <Term label="+ CMA Diff:" value={formatDiff(latest.cma_diff_mtd)} className="text-slate-900" />
            <Term label="+ Midland Diff:" value={formatDiff(latest.midland_diff_mtd)} className="text-emerald-700" />
          </>
        )}
        <Term label="- Lease Diff:" value={leaseDiff} className="text-bad" />
        <span className="whitespace-nowrap font-bold">
          = <span className="text-blue-700">{result}</span>
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-3">
        * See{" "}
        <a href="#exhibit-a" className="text-blue-600 hover:text-blue-700 underline">
          Exhibit A
        </a>{" "}
        for lease transportation differentials
      </p>
    </Panel>
  );
}
