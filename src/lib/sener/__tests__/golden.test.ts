// Golden test: the Manus python calculator's outputs for the anonymized rev-49
// workspace (generated 2026-10-20) must be reproduced by the TS port.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calculate } from "../calculator";
import type { Horizon, SenerWorkspace } from "../types";
import { validateWorkspace } from "../validate";
import { isClose } from "./helpers";

interface Snapshot {
  workspace: SenerWorkspace;
  expected: Record<Horizon, Record<string, unknown>>;
}

const snapshot: Snapshot = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "snapshot-rev49.json"), "utf8"),
);

/** Recursive compare: numbers rel 1e-9 / abs 1e-6, arrays in order, objects with identical key order. */
function compare(actual: unknown, expected: unknown, at: string, problems: string[]): void {
  if (typeof expected === "number") {
    if (typeof actual !== "number" || !isClose(actual, expected, 1e-9, 1e-6)) problems.push(`${at}: ${String(actual)} != ${expected}`);
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      problems.push(`${at}: length ${Array.isArray(actual) ? actual.length : "n/a"} != ${expected.length}`);
      return;
    }
    expected.forEach((v, i) => compare(actual[i], v, `${at}[${i}]`, problems));
    return;
  }
  if (expected !== null && typeof expected === "object") {
    const exp = expected as Record<string, unknown>;
    const act = (actual ?? {}) as Record<string, unknown>;
    const keys = Object.keys(exp);
    if (JSON.stringify(Object.keys(act)) !== JSON.stringify(keys)) problems.push(`${at}: keys ${Object.keys(act)} != ${keys}`);
    keys.forEach((k) => compare(act[k], exp[k], `${at}.${k}`, problems));
    return;
  }
  if (actual !== expected) problems.push(`${at}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

describe("golden snapshot rev49", () => {
  it("fixture workspace passes validateWorkspace", () => {
    const out = validateWorkspace(snapshot.workspace);
    expect(out.records).toHaveLength(snapshot.workspace.records.length);
    expect(out.documents).toHaveLength(snapshot.workspace.documents.length);
  });

  it.each(Object.keys(snapshot.expected) as Horizon[])("%s matches the python output", (horizon) => {
    const result = calculate(snapshot.workspace.records, { horizon, today: "2026-10-24" });
    const problems: string[] = [];
    compare(result, snapshot.expected[horizon], horizon, problems);
    expect(problems).toEqual([]);
  });
});
