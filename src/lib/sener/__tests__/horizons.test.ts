// Port of tests/test_horizons.py.

import { describe, expect, it } from "vitest";
import { calculate } from "../calculator";
import { LITERS_PER_GALLON as G, ROLES, type SenerRecord } from "../types";
import { HORIZON_MONTHS, TODAY, expectClose } from "./helpers";

function rows(): SenerRecord[] {
  return [
    { id: "s", company: "Supply test", role: "supplier", fuels: ["Diesel"], quantity: 1000, unit: "gal", period: "monthly", status: "active", agreement: "Contract" },
    { id: "t", company: "Transport test", role: "transport", fuels: ["Diesel"], quantity: 1000 * G, unit: "L", period: "monthly", status: "active" },
    { id: "c", company: "Customer test", role: "customer", fuels: ["Diesel"], quantity: 1000 * G, unit: "L", period: "monthly", status: "active" },
  ];
}

describe("calculation horizons", () => {
  it.each(HORIZON_MONTHS)("%s matches all stages without changing sources", (horizon, months) => {
    const records = rows();
    const unchanged = structuredClone(records);
    const result = calculate(records, { horizon, today: TODAY });
    expect(result.months).toBe(months);
    expect(result.horizon).toBe(horizon);
    for (const role of ROLES) {
      expectClose(result.totals[role], 1000 * G * months);
      expectClose(result.gallons[role], 1000 * months);
      expect(result.counts[role]).toBe(1);
    }
    expectClose(result.matchedGallons, 1000 * months);
    expectClose(result.contractTotals.supplier, 1000 * G * months);
    expect(result.demandCoverage).toBe(100);
    expectClose(result.byFuel[0].matched, 1000 * G * months);
    expectClose(result.transportAllocations[0].liters, 1000 * G * months);
    expect(records).toEqual(unchanged);
  });

  it("gaps, scenarios and shared capacity scale once", () => {
    const [s, t, c] = rows();
    const s1: SenerRecord = { ...s, fuels: ["Gasoline"], quantity: 100, unit: "L" };
    const t1: SenerRecord = { ...t, fuels: ["Gasoline", "Diesel"], quantity: 100 };
    const c1: SenerRecord = { ...c, quantity: 100 };
    const records = [s1, t1, c1, { ...s1, id: "s2", fuels: ["Diesel"], agreement: "Non-binding LOI" as const }, { ...c1, id: "c2", fuels: ["Gasoline"] }];
    const monthly = calculate(records, { factors: { supplier: 2 }, today: TODAY });
    const annual = calculate(records, { factors: { supplier: 2 }, horizon: "annual", today: TODAY });
    expect(annual.matchedLiters).toBe(1200);
    expect(annual.byFuel.reduce((sum, x) => sum + x.matched, 0)).toBe(1200);
    for (const key of ["matchedLiters", "uncoveredDemand", "productConstraintGap", "eligibleProductLiters"] as const) {
      expectClose(annual[key], monthly[key] * 12);
    }
    for (const key of ["totals", "gallons", "unused", "gapsToDemand", "contractTotals"] as const) {
      for (const role of ROLES) expectClose(annual[key][role], monthly[key][role] * 12);
    }
    expect(annual.counts).toEqual(monthly.counts);
    expect(annual.demandCoverage).toBe(monthly.demandCoverage);
  });

  it("source periods and exclusions stay consistent", () => {
    const [s, t, c] = rows();
    const annualSupply = { ...s, quantity: 12000, period: "annual" as const };
    expectClose(calculate([annualSupply, t, c], { horizon: "semester", today: TODAY }).matchedGallons, 6000);
    const oneTime = { ...annualSupply, period: "one-time" as const };
    expect(calculate([oneTime, t, c], { horizon: "annual", today: TODAY }).matchedLiters).toBe(0);
    const expired = { ...annualSupply, period: "monthly" as const, validUntil: "2000-01-01" };
    expect(calculate([expired, t, c], { horizon: "quarterly", today: TODAY }).matchedLiters).toBe(0);
  });

  it("defaults to monthly and rejects invalid horizons", () => {
    expect(calculate([], { today: TODAY }).horizon).toBe("monthly");
    for (const [horizon, months] of HORIZON_MONTHS) {
      expectClose(calculate(rows(), { horizon, today: TODAY }).matchedGallons, 1000 * months);
    }
    expect(() => calculate([], { horizon: "invalid" as never })).toThrow();
  });
});
