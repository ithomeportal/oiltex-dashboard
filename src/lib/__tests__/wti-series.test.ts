import { describe, expect, it } from "vitest";
import { WTI_PRICE_SERIES, wtiDailySeriesSql } from "../wti-series";

describe("WTI_PRICE_SERIES", () => {
  it("contains only outright WTI price series, never differentials", () => {
    for (const s of WTI_PRICE_SERIES) {
      expect(s.priceType).not.toMatch(/DIFF/);
    }
  });

  it("uses only the front month of the NYMEX_EIA strip (CL2-CL4 are not the price)", () => {
    const eia = WTI_PRICE_SERIES.filter((s) => s.source === "NYMEX_EIA").map((s) => s.priceType);
    expect(eia).toEqual(["WTI_FUTURES_CL1"]);
  });

  it("excludes Houston (a different delivery point)", () => {
    expect(WTI_PRICE_SERIES.some((s) => s.priceType.includes("HOUSTON"))).toBe(false);
  });

  it("prefers NYMEX settlement first", () => {
    expect(WTI_PRICE_SERIES[0]).toEqual({ source: "NYMEX", priceType: "WTI_SETTLEMENT" });
  });
});

describe("wtiDailySeriesSql", () => {
  const sql = wtiDailySeriesSql("AND date >= '2025-01-01'");

  it("filters on (source, price_type) pairs, not source alone", () => {
    expect(sql).toContain("(source, price_type) IN (");
    expect(sql).toContain("('NYMEX_EIA', 'WTI_FUTURES_CL1')");
    expect(sql).not.toContain("WTI_MIDLAND_DIFF");
  });

  it("ranks by the series order and keeps one row per day", () => {
    expect(sql).toContain("WHEN source = 'NYMEX' AND price_type = 'WTI_SETTLEMENT' THEN 1");
    expect(sql).toContain("PARTITION BY date");
    expect(sql).toContain("WHERE rn = 1");
  });

  it("drops weekend-dated rows (markets closed)", () => {
    expect(sql).toContain("EXTRACT(ISODOW FROM date) < 6");
  });

  it("caps at today and applies the extra date filter", () => {
    expect(sql).toContain("date < CURRENT_DATE");
    expect(sql).toContain("AND date >= '2025-01-01'");
  });
});
