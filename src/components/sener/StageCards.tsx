"use client";

import { ROLES, type Role } from "@/lib/sener/types";
import { num, short } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { Icon } from "./ui";

const NAMES: Record<Role, string> = {
  supplier: "US fuel supply",
  transport: "Mexico transport",
  customer: "Customer demand",
};
const ICON: Record<Role, string> = { supplier: "refinery", transport: "truck", customer: "fuel" };

export default function StageCards() {
  const { base, scenario, factors, period } = useSener();
  if (!base || !scenario) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {ROLES.map((role, i) => {
        const changed = Math.abs(factors[role] - 1) > 0.001;
        const unused = scenario.unused[role];
        const flag =
          role === "customer"
            ? scenario.uncoveredDemand > 1
              ? "Fuel-specific gap"
              : "Covered"
            : scenario.gapsToDemand[role] > 1
              ? "Capacity gap"
              : unused > 1
                ? "Available surplus"
                : "Balanced";
        const warning = flag.includes("gap");
        const activeCustomers = base.activeCustomerCount ?? base.activeCounts?.customer ?? base.counts.customer;
        return (
          <article key={role} className="bg-white rounded-xl shadow-sm p-6" style={{ border: "3px solid #D4222E" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Icon name={ICON[role]} className="w-5 h-5 text-slate-500" />
                {NAMES[role]}
              </div>
              <span className="text-xs font-mono text-slate-400">0{i + 1}</span>
            </div>
            <div className="text-3xl font-bold text-slate-800">
              {short(scenario.totals[role])}
              <span className="text-sm font-medium text-slate-500 ml-1">L / {period.unit}</span>
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {num(scenario.gallons[role])} US gal / {period.unit}
              {changed ? " · SCENARIO" : ""}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
              <span>
                {role === "customer" ? `${activeCustomers} active customers · ` : ""}
                {base.activeCounts?.[role] ?? base.counts[role]} active / {base.counts[role]}{" "}
                {role === "customer" ? "fuel lines" : "records"}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${
                  warning ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"
                }`}
              >
                {flag}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
