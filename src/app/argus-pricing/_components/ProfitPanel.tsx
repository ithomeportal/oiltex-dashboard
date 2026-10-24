import type { ReactNode } from "react";
import { Panel } from "@/components/ui/Panel";
import { CARD } from "@/components/ui/styles";
import { DASH, fmtSigned } from "@/lib/format";
import { fmtThousands, formatMonthName, formatPrice, type ProfitData } from "../_lib";

interface ProfitPanelProps {
  profitData: ProfitData;
  transport: number;
}

interface ProfitTileProps {
  label: string;
  value: ReactNode;
  valueClass?: string;
  lines?: readonly ReactNode[];
  className?: string;
}

/** Light KPI card that allows several detail lines (KpiTile truncates to one). */
function ProfitTile({ label, value, valueClass = "text-slate-900", lines = [], className = "" }: ProfitTileProps) {
  return (
    <div className={`${CARD} p-4 min-w-0 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums ${valueClass}`}>{value}</p>
      {lines.map((line, i) => (
        <div key={i} className="mt-1 text-xs text-slate-500 tabular-nums">
          {line}
        </div>
      ))}
    </div>
  );
}

const signClass = (n: number | null) => (n === null ? "text-slate-900" : n >= 0 ? "text-good" : "text-bad");

function NetProfitTile({ profitData, transport }: ProfitPanelProps) {
  const bbls = profitData.volume.delivered_bbls;
  const grossRevenue = profitData.marathon.sell_price !== null && bbls > 0
    ? profitData.marathon.sell_price * bbls
    : null;
  // Devon charges buy_price MINUS Exhibit A transport (the credit is baked into their invoice)
  const devonInvoicePerBbl = profitData.devon.buy_price_before_transport !== null
    ? profitData.devon.buy_price_before_transport - transport
    : null;
  const oilCost = devonInvoicePerBbl !== null && bbls > 0
    ? devonInvoicePerBbl * bbls
    : null;
  const actualFreight = profitData.freight.total_cost;
  // Net = Marathon revenue - Devon invoice - Actual freight
  const netProfit = grossRevenue !== null && oilCost !== null
    ? grossRevenue - oilCost - actualFreight
    : null;
  const netPerBbl = netProfit !== null && bbls > 0
    ? netProfit / bbls
    : null;

  const frame = netProfit === null
    ? CARD
    : netProfit >= 0
      ? "bg-emerald-50/60 rounded-xl border border-emerald-200 shadow-sm"
      : "bg-red-50/60 rounded-xl border border-red-200 shadow-sm";

  return (
    <div className={`${frame} p-4 min-w-0 col-span-2`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Net Profit (Actual Freight)</p>
          <p className={`mt-1.5 text-3xl font-semibold tracking-tight tabular-nums ${signClass(netProfit)}`}>
            {netProfit !== null ? `${netProfit >= 0 ? "+" : "-"}$${fmtThousands(Math.abs(netProfit))}` : DASH}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {formatMonthName(profitData.delivery_month)}
            {netPerBbl !== null && (
              <span className={`font-semibold ${signClass(netPerBbl)}`}>
                {` | ${fmtSigned(netPerBbl, 2, "$")}/bbl`}
              </span>
            )}
          </p>
        </div>
        <dl className="text-xs tabular-nums text-slate-600 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right">
          <dt className="text-slate-500">Revenue</dt>
          <dd className="font-medium text-slate-800">{grossRevenue !== null ? `$${fmtThousands(grossRevenue)}` : DASH}</dd>
          <dt className="text-slate-500">Oil cost (Devon - ${transport.toFixed(2)} Exhibit A)</dt>
          <dd className="font-medium text-slate-800">{oilCost !== null ? `$${fmtThousands(oilCost)}` : DASH}</dd>
          <dt className="text-slate-500">Freight (McLeod actual)</dt>
          <dd className="font-medium text-slate-800">${fmtThousands(actualFreight)}</dd>
        </dl>
      </div>
    </div>
  );
}

export function ProfitPanel({ profitData, transport }: ProfitPanelProps) {
  const { devon, marathon, freight, volume } = profitData;
  const buyPrice = devon.buy_price_before_transport !== null
    ? devon.buy_price_before_transport - transport
    : null;
  const margin = buyPrice !== null && marathon.sell_price !== null
    ? marathon.sell_price - buyPrice
    : null;
  const closed = marathon.trading_days > 0 && devon.trading_days > 0;

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          Monthly P&amp;L — {formatMonthName(profitData.delivery_month)} Delivery
          {closed && (
            <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Closed</span>
          )}
        </span>
      }
      subtitle="Devon buy vs Marathon sell, with actual McLeod freight"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <ProfitTile
            label="Buy Price (Devon)"
            value={buyPrice !== null ? `$${formatPrice(buyPrice)}` : DASH}
            valueClass="text-orange-700"
            lines={[
              `CMA + Diffs - $${transport.toFixed(2)} transport (Exhibit A)`,
              `${devon.trading_days} trading days (${devon.period.start.slice(5)} to ${devon.period.end.slice(5)})`,
            ]}
          />
          <ProfitTile
            label="Sell Price (Marathon)"
            value={marathon.sell_price !== null ? `$${formatPrice(marathon.sell_price)}` : DASH}
            valueClass="text-cyan-700"
            lines={[
              "CMA - $0.25 + Diffs",
              `${marathon.trading_days} days (${marathon.period.start.slice(5)} to ${marathon.period.end.slice(5)})`,
            ]}
          />
          <ProfitTile
            label="Contract Margin"
            className="col-span-2 md:col-span-1"
            value={margin !== null ? fmtSigned(margin, 2, "$") : DASH}
            valueClass={signClass(margin)}
            lines={["per bbl (Exhibit A rate)"]}
          />
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <ProfitTile
            label="Actual Freight (McLeod)"
            value={freight.total_cost > 0 ? `$${fmtThousands(freight.total_cost)}` : DASH}
            valueClass="text-violet-700"
            lines={[
              `${freight.order_count} transport orders`,
              ...(freight.cost_per_bbl !== null
                ? [
                    <span key="per-bbl" className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium text-violet-700">${freight.cost_per_bbl.toFixed(2)}/bbl</span>
                      <span className={freight.cost_per_bbl < transport ? "text-good" : "text-bad"}>
                        ({freight.cost_per_bbl < transport ? "saves" : "costs"} $
                        {Math.abs(transport - freight.cost_per_bbl).toFixed(2)} vs Exhibit A)
                      </span>
                    </span>,
                  ]
                : []),
            ]}
          />
          <ProfitTile
            label="Delivered Volume"
            value={volume.delivered_bbls > 0 ? fmtThousands(volume.delivered_bbls) : DASH}
            lines={[
              `${volume.ticket_count} tickets`,
              ...(volume.shrinkage !== 0
                ? [
                    <span key="shrink" className="text-warn">
                      {volume.shrinkage > 0 ? "+" : ""}
                      {volume.shrinkage.toFixed(1)} bbl vs net (
                      {((volume.shrinkage / volume.net_barrels) * 100).toFixed(2)}%)
                    </span>,
                  ]
                : []),
            ]}
          />
          <NetProfitTile profitData={profitData} transport={transport} />
        </div>
      </div>
    </Panel>
  );
}
