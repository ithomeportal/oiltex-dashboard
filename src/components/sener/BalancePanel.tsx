"use client";

import { ROLES, type Role } from "@/lib/sener/types";
import { G, STAGE_LABEL, num, short } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { CARD, Icon } from "./ui";

const ICON: Record<Role, string> = { supplier: "refinery", transport: "truck", customer: "fuel" };
const BAR: Record<Role, string> = { supplier: "bg-slate-700", transport: "bg-slate-500", customer: "bg-blue-600" };

export default function BalancePanel() {
  const { base, scenario, factors, period, workspace } = useSener();
  if (!base || !scenario) return null;
  const max = Math.max(...Object.values(base.totals), ...Object.values(scenario.totals), 1);
  const changed = Object.values(factors).some((x) => x !== 1);
  const gap = scenario.uncoveredDemand;
  const bottleneck = scenario.bottlenecks.map((r) => STAGE_LABEL[r as Role] || "Product compatibility").join(" + ");
  const pools = (scenario.supplierAllocations || []).filter(
    (row) => (workspace.records.find((r) => r.id === row.id)?.fuels.filter((f) => f !== "Other").length ?? 0) > 1,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <section className={`${CARD} lg:col-span-2`}>
        <div className="flex flex-wrap items-start justify-between gap-2 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{period.label} volume balance</h2>
            <p className="text-sm text-slate-500">
              Potential volumes across the fuel journey · {period.months} {period.months === 1 ? "month" : "months"}
            </p>
          </div>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <i className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" />
              Documented
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
              Scenario
            </span>
          </div>
        </div>
        <div className="space-y-4">
          {ROLES.map((role) => (
            <div key={role} className="grid grid-cols-[110px_1fr_120px] items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Icon name={ICON[role]} />
                {STAGE_LABEL[role]}
              </div>
              <div className="relative h-7 bg-slate-100 rounded">
                <div className={`absolute inset-y-0 left-0 rounded ${BAR[role]}`} style={{ width: `${(base.totals[role] / max) * 100}%` }} />
                {changed && (
                  <div
                    className="absolute left-0 bottom-0 h-2 rounded bg-amber-400"
                    style={{ width: `${(scenario.totals[role] / max) * 100}%` }}
                  />
                )}
              </div>
              <div className="text-right text-sm font-semibold text-slate-800">
                {short(base.totals[role])} L
                <div className="text-xs font-normal text-slate-500">{short(base.gallons[role])} US gal</div>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[110px_1fr_120px] gap-3 text-[11px] text-slate-400">
            <span />
            <div className="flex justify-between">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <span key={f}>{f === 0 ? "0" : short(max * f) + (f === 1 ? " L" : "")}</span>
              ))}
            </div>
            <span />
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 mt-5 pt-4 border-t border-slate-100 text-sm">
          <span className="inline-flex items-center gap-2 text-slate-600">
            <i className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            Matchable {period.label.toLowerCase()} volume
          </span>
          <strong className="text-slate-800">
            {num(scenario.matchedLiters)} L / {num(scenario.matchedGallons)} US gal
          </strong>
        </div>
      </section>

      <section className={CARD}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Allocation insight</h2>
          <Icon name="spark" className="w-5 h-5 text-slate-400" />
        </div>
        <div className="text-xs font-semibold tracking-wider text-slate-400">CUSTOMER DEMAND COVERAGE</div>
        <div className="flex items-baseline gap-2 mt-1">
          <strong className="text-3xl font-bold text-slate-800">{num(scenario.demandCoverage, 1)}%</strong>
          <span className="text-sm text-slate-500">{changed ? "in this scenario" : "of customer demand covered"}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded mt-3">
          <div className="h-2 bg-green-500 rounded" style={{ width: `${Math.min(100, scenario.demandCoverage)}%` }} />
        </div>
        <p className="text-xs text-slate-500 mt-3">
          {num(scenario.matchedLiters)} L matched ÷ {num(scenario.totals.customer)} L customer demand.
          <br />
          This is demand coverage, not supplier capacity utilization.
        </p>
        <div className="flex gap-2 mt-4 p-3 rounded-lg bg-slate-50 text-sm text-slate-700">
          <Icon name={gap > 1 ? "alert" : "check"} className={`w-5 h-5 shrink-0 ${gap > 1 ? "text-amber-600" : "text-green-600"}`} />
          <div>
            <strong className="block">
              {gap > 1
                ? `${bottleneck} is limiting volume.`
                : scenario.totals.customer
                  ? "Demand is volume-covered."
                  : "Add counterparties to begin."}
            </strong>
            {gap > 1 ? (
              <>
                {num(gap)} L ({num(gap / G)} gal) of demand remains unmatched.
                {(scenario.unmatchedByFuel || []).map((row) => (
                  <span key={row.fuel} className="block">
                    {row.fuel}: {num(row.liters)} L unmatched · eligible supply {num(row.eligibleSupply)} L.
                  </span>
                ))}
              </>
            ) : scenario.totals.customer ? (
              "Supply and eligible transport support your current demand."
            ) : (
              "Upload your first LOI or add a record manually."
            )}
          </div>
        </div>
        {pools.map((row) => {
          const parts = Object.entries(row.byFuel).filter(([, liters]) => liters > 0.1);
          return (
            <p key={row.id} className="text-xs text-slate-600 mt-3">
              <strong>Shared pool assigned — {row.company}</strong>
              <br />
              {parts.length
                ? parts.map(([f, liters]) => `${f}: ${num(liters)} L`).join(" · ")
                : "No customer demand currently allocated."}
            </p>
          );
        })}
        <p className="text-xs text-slate-400 mt-4">
          {period.label} planning projection, not a permit-readiness finding.
          {base.excludedIds.length
            ? ` ${base.excludedIds.length} draft, expired, zero-volume or unknown-period record(s) excluded.`
            : ""}
        </p>
      </section>
    </div>
  );
}
