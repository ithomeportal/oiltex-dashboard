import { describe, expect, it } from "vitest";
import { NYMEX_HOLIDAYS, calculateContractDates, formatDateStr, isBusinessDay } from "../nymex-calendar";

// month is 0-indexed delivery month, as used by the calendar page
const ltd = (year: number, month: number) => formatDateStr(calculateContractDates(year, month).lastTradingDay);
const fnd = (year: number, month: number) => formatDateStr(calculateContractDates(year, month).firstNoticeDay);

describe("NYMEX_HOLIDAYS", () => {
  it("covers every year the calendar offers (2025–2028)", () => {
    for (const year of [2025, 2026, 2027, 2028]) {
      const count = Object.keys(NYMEX_HOLIDAYS).filter((d) => d.startsWith(`${year}-`)).length;
      expect(count, `holidays in ${year}`).toBeGreaterThanOrEqual(8);
    }
  });

  it("only lists weekdays (observed dates)", () => {
    for (const d of Object.keys(NYMEX_HOLIDAYS)) {
      const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
      expect(dow, d).toBeGreaterThan(0);
      expect(dow, d).toBeLessThan(6);
    }
  });

  it("does not observe New Year 2028 (Saturday) on Fri 2027-12-31", () => {
    expect(NYMEX_HOLIDAYS["2027-12-31"]).toBeUndefined();
    expect(NYMEX_HOLIDAYS["2028-01-01"]).toBeUndefined();
  });

  it("includes Christmas 2024 so CLF25 (shown in the 2025 view) is right", () => {
    expect(NYMEX_HOLIDAYS["2024-12-25"]).toBe("Christmas");
  });
});

describe("isBusinessDay", () => {
  it("is false on weekends and holidays", () => {
    expect(isBusinessDay(new Date(2025, 3, 18))).toBe(false); // Good Friday 2025
    expect(isBusinessDay(new Date(2028, 10, 23))).toBe(false); // Thanksgiving 2028
    expect(isBusinessDay(new Date(2025, 0, 25))).toBe(false); // Saturday
    expect(isBusinessDay(new Date(2025, 0, 24))).toBe(true);
  });
});

describe("calculateContractDates — CME CL last trading day", () => {
  it("matches published 2025 last trading days", () => {
    expect(ltd(2025, 0)).toBe("2024-12-19"); // CLF25: Dec 25 holiday → 4 bd back
    expect(ltd(2025, 1)).toBe("2025-01-21"); // CLG25: Jan 25 Saturday
    expect(ltd(2025, 4)).toBe("2025-04-22"); // CLK25: Apr 25 business day → 3 bd back
    expect(ltd(2025, 5)).toBe("2025-05-20"); // CLM25: May 25 Sunday
    expect(ltd(2025, 7)).toBe("2025-07-22"); // CLQ25
    expect(ltd(2025, 10)).toBe("2025-10-21"); // CLX25
    expect(ltd(2026, 0)).toBe("2025-12-19"); // CLF26: needs Christmas 2025
  });

  it("applies 2028 holidays", () => {
    expect(ltd(2028, 11)).toBe("2028-11-20"); // CLZ28: skips Thanksgiving Nov 23
    expect(ltd(2029, 0)).toBe("2028-12-19"); // CLF29: Dec 25 2028 holiday
    expect(ltd(2028, 5)).toBe("2028-05-22"); // CLM28: May 25 Thursday
  });

  it("first notice day is the next business day, skipping holidays", () => {
    expect(fnd(2028, 11)).toBe("2028-11-21");
    expect(fnd(2025, 4)).toBe("2025-04-23");
  });
});

describe("formatDateStr", () => {
  it("uses the local calendar date (no UTC shift)", () => {
    expect(formatDateStr(new Date(2028, 0, 1))).toBe("2028-01-01");
    expect(formatDateStr(new Date(2025, 11, 31, 23, 30))).toBe("2025-12-31");
  });
});
