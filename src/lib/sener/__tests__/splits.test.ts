// Port of tests/test_customer_splits.py.

import { describe, expect, it } from "vitest";
import { calculate } from "../calculator";
import { LITERS_PER_GALLON as G, type SenerRecord } from "../types";
import { validateRecord, validateSplitGroups, validateWorkspace } from "../validate";
import { HORIZON_MONTHS, TODAY, expectClose } from "./helpers";

function splits(): SenerRecord[] {
  return ([["Gasoline", 23350], ["Diesel", 18548], ["Jet fuel", 2350]] as const).map(([fuel, qty], i) => ({
    id: String(i), company: "Split Test Customer", role: "customer", fuels: [fuel], quantity: qty,
    unit: "L", period: "monthly", status: "active", splitGroupId: "test-group",
  }));
}

const byFuel = (rows: SenerRecord[]) =>
  Object.fromEntries(calculate(rows, { today: TODAY }).byFuel.map((r) => [r.fuel, r]));

describe("customer split groups", () => {
  it.each(HORIZON_MONTHS)("%s: splits count each fuel, not a parent or three customers", (horizon, months) => {
    const rows = splits();
    validateSplitGroups(rows);
    const x = calculate(rows, { horizon, today: TODAY });
    expect(x.totals.customer).toBe((23350 + 18548 + 2350) * months);
    expect(x.customerCount).toBe(1);
    expect(x.activeCustomerCount).toBe(1);
    expect(x.counts.customer).toBe(3);
    const f = Object.fromEntries(x.byFuel.map((r) => [r.fuel, r]));
    expect(f.Gasoline.demand).toBe(23350 * months);
    expect(f.Diesel.demand).toBe(18548 * months);
    expect(f["Jet fuel"].demand).toBe(2350 * months);
    expect(Object.values(f).every((r) => r.customers === 1)).toBe(true);
    expect(x.matchedLiters).toBe(0);
  });

  it("same company on many LOI lines counts once; exclusions do not add", () => {
    const base = splits();
    const rows = [
      ...base,
      { ...base[0], id: "extra", company: " split  test customer ", quantity: 100, splitGroupId: "another-group" },
      { ...base[1], id: "draft", company: "Draft company", status: "draft" as const, splitGroupId: "draft-group" },
    ];
    const x = calculate(rows, { today: TODAY });
    expect(x.activeCustomerCount).toBe(1);
    expect(x.customerCount).toBe(2);
    expect(x.byFuel.find((r) => r.fuel === "Gasoline")?.customers).toBe(1);
    expect(x.totals.customer).toBe(44348);
    const gal = [{ ...rows[0], unit: "gal" as const }, ...rows.slice(1)];
    expectClose(byFuel(gal).Gasoline.demand, 23350 * G + 100);
  });

  it("validates customer identity, source and unique fuels", () => {
    const rows = splits();
    expect(validateWorkspace({ version: 1, records: rows, documents: [] }).records).toEqual(rows.map(validateRecord));
    const changes: Partial<SenerRecord>[] = [
      { role: "supplier" }, { company: "Different company" }, { fuels: ["Gasoline"] },
      { splitGroupId: ["bad"] as unknown as string },
    ];
    for (const change of changes) {
      const bad = splits();
      const mutated = [...bad.slice(0, -1), { ...bad[bad.length - 1], ...change }];
      expect(() => validateSplitGroups(mutated)).toThrow();
    }
    const bad = splits();
    expect(() => validateSplitGroups([...bad.slice(0, -1), { ...bad[2], sourceId: "different-letter" }])).toThrow();
  });

  it.each([
    ["status", "draft"], ["period", "annual"], ["agreement", "Contract"], ["location", "Another location"],
    ["segment", "Station network"], ["stations", 3], ["validUntil", "2099-01-01"], ["notes", "Different common note"],
  ] as const)("common field %s cannot contradict", (key, value) => {
    const rows = splits();
    const bad = [...rows.slice(0, -1), { ...rows[2], [key]: value }];
    expect(() => validateSplitGroups(bad)).toThrow(/same on every product/);
  });

  it("company case and whitespace variants group together", () => {
    const rows = splits();
    const variant = [rows[0], { ...rows[1], company: "  split   test CUSTOMER " }, rows[2]];
    expect(() => validateSplitGroups(variant)).not.toThrow();
    expect(calculate(variant, { today: TODAY }).customerCount).toBe(1);
  });

  it("rejects non-customer and over-long group ids", () => {
    const rows = splits();
    expect(() => validateSplitGroups([{ ...rows[0], splitGroupId: "x".repeat(101) }])).toThrow(/at most 100/);
    expect(() => validateSplitGroups([{ ...rows[0], splitGroupId: "   " }])).toThrow(/non-empty/);
    expect(() => validateSplitGroups([{ ...rows[0], splitGroupId: "" }, { ...rows[0], splitGroupId: undefined }])).not.toThrow();
  });
});
