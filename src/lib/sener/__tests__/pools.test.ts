// Port of tests/test_supplier_pools.py.

import { describe, expect, it } from "vitest";
import { calculate } from "../calculator";
import { LITERS_PER_GALLON as G } from "../types";
import { HORIZON_MONTHS, TODAY, expectClose, record } from "./helpers";

const calc = (rows: Parameters<typeof calculate>[0], opts = {}) => calculate(rows, { today: TODAY, ...opts });

describe("shared supplier pools", () => {
  it("shared supplier pool counts once, not per product", () => {
    const result = calc([record("s", "supplier", ["Gasoline", "Diesel"], 100), record("c1", "customer", "Gasoline", 100), record("c2", "customer", "Diesel", 100), record("t", "transport", ["Gasoline", "Diesel"], 500)]);
    expect(result.totals.supplier).toBe(100);
    expect(result.matchedLiters).toBe(100);
    expect(result.byFuel.reduce((s, r) => s + r.matched, 0)).toBe(100);
    expect(result.eligibleProductLiters).toBe(100);
    expect(result.hasSharedSupplierPools).toBe(true);
    expect(result.byFuel.every((r) => r.supply === 100)).toBe(true);
    expect(result.supplierAllocations.reduce((s, r) => s + r.liters, 0)).toBe(100);
    expect(result.demandCoverage).toBe(50);
  });

  it("pool can reassign for dedicated supply and transport", () => {
    const result = calc([record("shared", "supplier", ["Gasoline", "Diesel"], 100), record("gas", "supplier", "Gasoline", 100), record("cg", "customer", "Gasoline", 100), record("cd", "customer", "Diesel", 100), record("flex", "transport", ["Gasoline", "Diesel"], 100), record("diesel", "transport", "Diesel", 100)]);
    expect(result.matchedLiters).toBe(200);
    expect(result.demandCoverage).toBe(100);
    const pool = result.supplierAllocations.find((r) => r.id === "shared");
    expectClose(pool?.byFuel.Diesel ?? NaN, 100);
  });

  it.each(HORIZON_MONTHS)("%s: approved Sunoco case covers demand without changing quantity", (horizon, months) => {
    const rows = [record("sunoco", "supplier", ["Gasoline", "Diesel"], 4_000_000, "gal"), record("truck", "transport", ["Gasoline", "Diesel"], 4_800_000, "gal"), record("gas", "customer", "Gasoline", 196841.412768), record("diesel", "customer", "Diesel", 1179158.2171632)];
    const previous = structuredClone(rows);
    const result = calc(rows, { horizon });
    expect(result.demandCoverage).toBe(100);
    expect(result.uncoveredDemand).toBe(0);
    expectClose(result.matchedLiters, 1375999.6299312 * months);
    expectClose(result.totals.supplier, 4_000_000 * G * months);
    expect(rows).toEqual(previous);
    for (const row of result.byFuel) expectClose(row.matched, row.demand);
  });

  it("product filter is independent, not an additive pool", () => {
    const rows = [record("s", "supplier", ["Gasoline", "Diesel"], 100), record("cg", "customer", "Gasoline", 100), record("cd", "customer", "Diesel", 100), record("t", "transport", ["Gasoline", "Diesel"], 200)];
    expect(calc(rows).matchedLiters).toBe(100);
    expect(calc(rows, { fuel: "Gasoline" }).matchedLiters).toBe(100);
    expect(calc(rows, { fuel: "Diesel" }).matchedLiters).toBe(100);
  });
});
