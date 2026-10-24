import { describe, expect, it } from "vitest";
import { fmtBbls, fmtDayDate, fmtMoney, fmtNum, fmtPct, fmtSigned, toNum } from "../format";

describe("toNum", () => {
  it("parses pg DECIMAL strings and numbers", () => {
    expect(toNum("61.2345")).toBe(61.2345);
    expect(toNum(3)).toBe(3);
  });
  it("returns null for empty / invalid values", () => {
    expect(toNum(null)).toBeNull();
    expect(toNum(undefined)).toBeNull();
    expect(toNum("")).toBeNull();
    expect(toNum("abc")).toBeNull();
    expect(toNum(Number.NaN)).toBeNull();
  });
});

describe("fmtNum / fmtMoney", () => {
  it("formats with thousands separators and fixed decimals", () => {
    expect(fmtNum(12345.678)).toBe("12,345.68");
    expect(fmtNum("0.5", 4)).toBe("0.5000");
    expect(fmtMoney(61.5)).toBe("$61.50");
    expect(fmtMoney(1234567.891)).toBe("$1,234,567.89");
  });
  it("puts the minus sign before the dollar sign", () => {
    expect(fmtMoney(-2.26)).toBe("-$2.26");
  });
  it("renders missing values as an em dash", () => {
    expect(fmtNum(null)).toBe("—");
    expect(fmtMoney(undefined)).toBe("—");
  });
});

describe("fmtSigned", () => {
  it("always shows the sign (4-decimal differentials)", () => {
    expect(fmtSigned(0.1234, 4)).toBe("+0.1234");
    expect(fmtSigned(-1.5, 4)).toBe("-1.5000");
    expect(fmtSigned(0, 2)).toBe("+0.00");
  });
  it("supports a currency prefix", () => {
    expect(fmtSigned(1.2, 2, "$")).toBe("+$1.20");
    expect(fmtSigned(-1.2, 2, "$")).toBe("-$1.20");
  });
  it("returns an em dash for missing values", () => {
    expect(fmtSigned(null)).toBe("—");
  });
});

describe("fmtPct / fmtBbls", () => {
  it("formats signed percentages", () => {
    expect(fmtPct(1.234)).toBe("+1.2%");
    expect(fmtPct(-0.05, 2)).toBe("-0.05%");
  });
  it("formats barrels with 2 decimals by default, 0 when asked", () => {
    expect(fmtBbls(1234.5)).toBe("1,234.50");
    expect(fmtBbls(1234.5, 0)).toBe("1,235");
  });
});

describe("fmtDayDate", () => {
  it("renders ISO date followed by weekday (user preference)", () => {
    expect(fmtDayDate("2026-02-04")).toBe("2026-02-04 Wed");
  });
  it("accepts timestamps and Date objects without timezone drift", () => {
    expect(fmtDayDate("2026-02-04T00:00:00.000Z")).toBe("2026-02-04 Wed");
    expect(fmtDayDate(new Date("2026-02-04T00:00:00.000Z"))).toBe("2026-02-04 Wed");
  });
  it("returns an em dash for invalid input", () => {
    expect(fmtDayDate("")).toBe("—");
    expect(fmtDayDate(null)).toBe("—");
  });
});
