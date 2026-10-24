// Shared test helpers for the SENER calculator port (python-compatible asserts).

import { expect } from "vitest";
import type { Role, SenerRecord } from "../types";

export const TODAY = "2026-10-24";

/** python math.isclose */
export function isClose(a: number, b: number, relTol = 1e-9, absTol = 0): boolean {
  if (a === b) return true;
  return Math.abs(a - b) <= Math.max(relTol * Math.max(Math.abs(a), Math.abs(b)), absTol);
}

export function expectClose(actual: number, expected: number, relTol = 1e-9, absTol = 0): void {
  expect(isClose(actual, expected, relTol, absTol), `${actual} ≉ ${expected}`).toBe(true);
}

/** tests/test_calculator.py `record()` */
export function record(
  id: string,
  role: Role,
  fuel: string | string[],
  quantity: number,
  unit: "L" | "gal" = "L",
  extra: Partial<SenerRecord> = {},
): SenerRecord {
  return {
    id, company: id, role, fuels: Array.isArray(fuel) ? fuel : [fuel], quantity, unit,
    period: "monthly", status: "active", ...extra,
  };
}

export const HORIZON_MONTHS = [
  ["monthly", 1], ["quarterly", 3], ["semester", 6], ["annual", 12],
] as const;
