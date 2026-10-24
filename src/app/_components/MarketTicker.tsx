import { DeltaChip, KpiTile } from "@/components/ui/KpiTile";
import { KPI_GRID_4 } from "@/components/ui/styles";
import { fmtDayDate, fmtMoney, fmtPct, fmtSigned } from "@/lib/format";
import type { PriceData } from "./types";

interface MarketTickerProps {
  settlement?: PriceData;
  settlementSource: string | null;
  spot?: PriceData;
  spotSource: string | null;
  spotChange: number;
  spotChangePct: number;
  futures?: PriceData;
  midlandDiff?: PriceData;
}

function SourceLine({ source, date }: { source: string | null; date?: string }) {
  return (
    <span>
      {source || "N/A"}
      {date ? ` · ${fmtDayDate(date)}` : ""}
    </span>
  );
}

export function MarketTicker({
  settlement,
  settlementSource,
  spot,
  spotSource,
  spotChange,
  spotChangePct,
  futures,
  midlandDiff,
}: MarketTickerProps) {
  return (
    <div className={KPI_GRID_4}>
      <KpiTile
        label="NYMEX Settle"
        value={fmtMoney(settlement?.value)}
        sub={<SourceLine source={settlementSource} date={settlement?.date} />}
        hint="Latest NYMEX WTI settlement (fallbacks: Chart export, Investing.com)"
      />
      <KpiTile
        label="WTI Spot"
        value={fmtMoney(spot?.value)}
        sub={
          <span className="inline-flex items-center gap-2">
            {spotChange !== 0 && (
              <DeltaChip value={spotChange}>
                {fmtSigned(spotChange)} ({fmtPct(spotChangePct)})
              </DeltaChip>
            )}
            <SourceLine source={spotSource} date={spot?.date} />
          </span>
        }
        hint="WTI Cushing spot (EIA, FRED fallback); change vs previous print"
      />
      <KpiTile
        label="WTI Futures CL"
        value={fmtMoney(futures?.value)}
        sub={<SourceLine source="NYMEX" date={futures?.date} />}
        hint="Front-month WTI crude futures"
      />
      <KpiTile
        label="Midland Diff"
        value={fmtSigned(midlandDiff?.value, 2, "$")}
        sub={<SourceLine source="CME WTT" date={midlandDiff?.date} />}
        hint="WTI Midland vs Cushing differential (CME WTT)"
      />
    </div>
  );
}
