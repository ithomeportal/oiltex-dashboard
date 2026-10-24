import { KpiTile } from "@/components/ui/KpiTile";
import { KPI_GRID_5 } from "@/components/ui/styles";
import { DASH } from "@/lib/format";
import { formatDiff, formatDollar, formatPrice, type ArgusPricingRow, type Lease } from "../_lib";

interface KpiRowProps {
  latest: ArgusPricingRow | null | undefined;
  activeLease: Lease;
  isWtlLease: boolean;
  transport: number;
  estNetMtdMinusTransport: number | null;
}

export function KpiRow({ latest, activeLease, isWtlLease, transport, estNetMtdMinusTransport }: KpiRowProps) {
  return (
    <div className={KPI_GRID_5}>
      <KpiTile
        label="NYMEX CMA TD"
        value={<span className="text-amber-700">{formatDollar(latest?.nymex_cma_td)}</span>}
        sub="Running avg settlement"
      />
      <KpiTile label="CMA Diff MTD" value={formatDiff(latest?.cma_diff_mtd)} sub="WTI diff to CMA Nymex" />
      <KpiTile
        label="Midland Diff MTD"
        value={<span className="text-emerald-700">{formatDiff(latest?.midland_diff_mtd)}</span>}
        sub="WTL Midland vs WTI Cushing"
      />
      <KpiTile
        label="WTL Midland"
        value={formatDollar(latest?.wtl_midland_wtd_avg)}
        sub={`Wtd Avg (L: $${formatPrice(latest?.wtl_midland_low)} / H: $${formatPrice(latest?.wtl_midland_high)})`}
      />
      <KpiTile
        emphasis
        label={`Est. Net — ${activeLease.base}`}
        value={estNetMtdMinusTransport !== null ? `$${formatPrice(estNetMtdMinusTransport)}` : DASH}
        sub={`${isWtlLease ? "WTL Midland" : "CMA TD + Diffs"} - $${transport.toFixed(2)} lease diff`}
      />
    </div>
  );
}
