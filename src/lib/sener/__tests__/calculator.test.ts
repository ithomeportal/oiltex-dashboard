// Port of tests/test_calculator.py (pure-logic cases; HTTP cases live in validate.test.ts).

import { describe, expect, it } from "vitest";
import { calculate, currentUtcDate, monthlyLiters, toGallons } from "../calculator";
import { LITERS_PER_GALLON as G } from "../types";
import { TODAY, expectClose, record } from "./helpers";

const calc = (rows: Parameters<typeof calculate>[0], opts = {}) => calculate(rows, { today: TODAY, ...opts });

describe("calculator", () => {
  it("five million US gallons", () => {
    const rows = [record("s", "supplier", "Diesel", 5_000_000, "gal"), record("t", "transport", "Diesel", 5_000_000 * G), record("c", "customer", "Diesel", 5_000_000 * G)];
    const result = calc(rows);
    expectClose(result.matchedGallons, 5_000_000);
    expect(result.demandCoverage).toBe(100);
  });

  it("products are not fungible", () => {
    const result = calc([record("s", "supplier", "Gasoline", 100), record("t", "transport", ["Gasoline", "Diesel"], 100), record("c", "customer", "Diesel", 100)]);
    expect(result.matchedLiters).toBe(0);
    expect(result.bottlenecks).toEqual(["product compatibility"]);
  });

  it("shared transport counted once", () => {
    const rows = [record("s1", "supplier", "Gasoline", 100), record("s2", "supplier", "Diesel", 100), record("c1", "customer", "Gasoline", 100), record("c2", "customer", "Diesel", 100), record("t", "transport", ["Gasoline", "Diesel"], 100)];
    const result = calc(rows);
    expect(result.matchedLiters).toBe(100);
    expect(result.byFuel.reduce((s, x) => s + x.matched, 0)).toBe(100);
  });

  it("allocation reassigns for restricted transporter", () => {
    const rows = [record("s1", "supplier", "Gasoline", 100), record("s2", "supplier", "Diesel", 100), record("c1", "customer", "Gasoline", 100), record("c2", "customer", "Diesel", 100), record("t1", "transport", ["Gasoline", "Diesel"], 100), record("t2", "transport", ["Gasoline"], 100)];
    expect(calc(rows).matchedLiters).toBe(200);
  });

  it("excludes out-of-window dates, one-time periods, drafts and bad dates", () => {
    const r = record("s", "supplier", "Diesel", 100);
    expect(monthlyLiters({ ...r, validUntil: "2000-01-01" }, TODAY)).toBe(0);
    expect(monthlyLiters({ ...r, validFrom: "2100-01-01" }, TODAY)).toBe(0);
    expect(monthlyLiters({ ...r, period: "one-time" }, TODAY)).toBe(0);
    expect(monthlyLiters({ ...r, status: "draft" }, TODAY)).toBe(0);
    expect(monthlyLiters({ ...r, period: "daily" }, TODAY)).toBe(3000);
    expect(monthlyLiters({ ...r, validUntil: "bad" }, TODAY)).toBe(0);
  });

  it("validity bounds are inclusive of today", () => {
    const r = record("s", "supplier", "Diesel", 100);
    expect(monthlyLiters({ ...r, validFrom: TODAY, validUntil: TODAY }, TODAY)).toBe(100);
    expect(monthlyLiters({ ...r, validFrom: "2026-10-25" }, TODAY)).toBe(0);
    expect(monthlyLiters({ ...r, validUntil: "2026-10-23" }, TODAY)).toBe(0);
  });

  it("scenarios do not change records", () => {
    const r = record("s", "supplier", "Diesel", 100);
    expect(calc([r], { factors: { supplier: 2 } }).totals.supplier).toBe(200);
    expect(r.quantity).toBe(100);
  });

  it("invalid scenario factors fall back to 1", () => {
    const r = record("s", "supplier", "Diesel", 100);
    for (const bad of [-1, 3.5, Number.NaN, Number.POSITIVE_INFINITY, "2" as unknown as number]) {
      expect(calc([r], { factors: { supplier: bad } }).totals.supplier).toBe(100);
    }
    expect(calc([r], { factors: { supplier: 0 } }).totals.supplier).toBe(0);
    expect(calc([r], { factors: { supplier: 3 } }).totals.supplier).toBe(300);
  });

  it("empty register matches nothing", () => {
    const result = calc([]);
    expect(result.matchedLiters).toBe(0);
    expect(result.horizon).toBe("monthly");
  });

  it("'Other' products never falsely match", () => {
    const result = calc([record("s", "supplier", "Other", 100), record("t", "transport", "Other", 100), record("c", "customer", "Other", 100)]);
    expect(result.matchedLiters).toBe(0);
    const rows = [record("s", "supplier", "Other: Condensate", 100), record("t", "transport", "Other: Condensate", 100), record("c", "customer", "Other: Ethanol", 100)];
    expect(calc(rows).matchedLiters).toBe(0);
    const fixed = [...rows.slice(0, 2), { ...rows[2], fuels: ["Other: Condensate"] }];
    expect(calc(fixed).matchedLiters).toBe(100);
  });

  it("malformed dates zero the record instead of crashing", () => {
    const r = record("s", "supplier", "Diesel", 100);
    expect(monthlyLiters({ ...r, validFrom: 123 as unknown as string }, TODAY)).toBe(0);
  });

  it("rejects unknown fuel filters and horizons", () => {
    expect(() => calc([], { fuel: "Kerosene" })).toThrow("Unknown fuel filter");
    expect(() => calc([], { horizon: "weekly" as never })).toThrow("Unknown calculation period");
  });

  it("helpers", () => {
    expect(toGallons(G)).toBe(1);
    expect(currentUtcDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
