// Record/workspace validation — ports the 422 cases of test_calculator.py,
// test_customer_splits.py and test_shared_backend.py (validate_workspace).

import { describe, expect, it } from "vitest";
import type { SenerRecord } from "../types";
import {
  SenerValidationError,
  casefold,
  normalNumber,
  normalizeCompany,
  normalizedLineKey,
  validateRecord,
  validateWorkspace,
} from "../validate";
import { record } from "./helpers";

function validWorkspace(fileHash = "a".repeat(64)) {
  return {
    version: 1,
    records: [
      { id: "record-1", company: "Acme Fuel", role: "supplier", fuels: ["Diesel"], quantity: 100, unit: "L", period: "monthly", status: "active", sourceId: "document-1", location: "Houston" },
    ] as Record<string, unknown>[],
    documents: [
      { id: "document-1", name: "letter.pdf", hash: fileHash, fingerprint: "b".repeat(64), warnings: [] },
    ] as Record<string, unknown>[],
  };
}

const withRecord = (patch: Record<string, unknown>) => {
  const ws = validWorkspace();
  return { ...ws, records: [{ ...ws.records[0], ...patch }] };
};

describe("validateRecord", () => {
  it("applies pydantic defaults and keeps extras after declared fields", () => {
    const out = validateRecord({ id: "a", company: "A", role: "supplier", fuels: ["Diesel"], location: "Houston" });
    expect(out).toEqual({ id: "a", company: "A", role: "supplier", fuels: ["Diesel"], quantity: null, unit: "unknown", period: "unknown", status: "draft", validFrom: "", validUntil: "", location: "Houston" });
    expect(Object.keys(out).at(-1)).toBe("location");
  });

  it("coerces numeric quantities like pydantic lax mode", () => {
    const base = { id: "a", company: "A", role: "supplier", fuels: ["Diesel"] };
    expect(validateRecord({ ...base, quantity: "12.5" }).quantity).toBe(12.5);
    expect(validateRecord({ ...base, quantity: 1e13 }).quantity).toBe(1e13);
  });

  it.each([
    ["negative quantity", { quantity: -1 }],
    ["quantity above 1e13", { quantity: 1e13 + 1 }],
    ["non-finite quantity", { quantity: Number.POSITIVE_INFINITY }],
    ["text quantity", { quantity: "lots" }],
    ["numeric validFrom", { validFrom: 123 }],
    ["invalid validUntil", { validUntil: "invalid" }],
    ["impossible date", { validFrom: "2026-02-30" }],
    ["unknown role", { role: "broker" }],
    ["unknown unit", { unit: "bbl" }],
    ["unknown period", { period: "hourly" }],
    ["unknown status", { status: "archived" }],
    ["empty company", { company: "" }],
    ["long company", { company: "x".repeat(301) }],
    ["long id", { id: "x".repeat(101) }],
    ["no fuels", { fuels: [] }],
    ["seven fuels", { fuels: ["Gasoline", "Diesel", "Naphtha", "Jet fuel", "Fuel oil", "Other", "Other: Ethanol"] }],
    ["duplicate fuel", { fuels: ["Diesel", "Diesel"] }],
    ["unknown fuel", { fuels: ["Kerosene"] }],
    ["bad custom fuel", { fuels: ["Other:Ethanol"] }],
  ])("rejects %s", (_label, patch) => {
    const raw = { ...record("s", "supplier", "Diesel", 100), ...patch };
    expect(() => validateRecord(raw)).toThrow(SenerValidationError);
  });

  it("accepts custom 'Other: <name>' fuels", () => {
    expect(validateRecord(record("s", "supplier", ["Other: Condensate", "Diesel"], 1)).fuels).toEqual(["Other: Condensate", "Diesel"]);
  });

  it("does not mutate its input", () => {
    const raw = { ...record("s", "supplier", "Diesel", 100), extra: { nested: [1] } };
    const out = validateRecord(raw);
    expect(out.extra).not.toBe(raw.extra);
    expect(raw).not.toHaveProperty("validFrom");
  });
});

describe("validateWorkspace", () => {
  it("accepts and preserves record extras", () => {
    const out = validateWorkspace(validWorkspace());
    expect(out.records[0].location).toBe("Houston");
    expect(out.records[0].validFrom).toBe("");
    expect(validateWorkspace(out)).toEqual(out);
  });

  it.each([
    ["extra top-level key", { ...validWorkspace(), revision: 1 }, /exactly version/],
    ["missing key", { version: 1, records: [] }, /exactly version/],
    ["version 2", { ...validWorkspace(), version: 2 }, /version 1/],
    ["boolean version", { ...validWorkspace(), version: true }, /version 1/],
    ["non-array records", { ...validWorkspace(), records: {} }, /arrays/],
    ["too many records", { ...validWorkspace(), records: Array.from({ length: 2001 }, () => ({})) }, /2,000/],
  ])("rejects %s", (_label, ws, message) => {
    expect(() => validateWorkspace(ws)).toThrow(message);
  });

  it("rejects duplicate record ids and blank ids", () => {
    const ws = validWorkspace();
    const r = { ...ws.records[0], sourceId: undefined };
    expect(() => validateWorkspace({ ...ws, records: [r, r] })).toThrow(/Duplicate record IDs/);
    expect(() => validateWorkspace(withRecord({ id: "  " }))).toThrow(/record ID/);
  });

  it("rejects invalid and duplicate hashes", () => {
    expect(() => validateWorkspace(validWorkspace("A".repeat(64)))).toThrow(/SHA-256/);
    const dup = validWorkspace();
    const docs = [...dup.documents, { id: "document-2", name: "copy.pdf", hash: "a".repeat(64), fingerprint: "c".repeat(64) }];
    expect(() => validateWorkspace({ ...dup, documents: docs })).toThrow(/Duplicate document hashes/);
    const fp = [...dup.documents, { id: "document-2", name: "copy.pdf", fingerprint: "b".repeat(64) }];
    expect(() => validateWorkspace({ ...dup, documents: fp })).toThrow(/Duplicate document fingerprints/);
    const emptyHash = [...dup.documents, { id: "document-2", name: "copy.pdf", hash: "", fingerprint: null }];
    expect(() => validateWorkspace({ ...dup, documents: emptyHash })).not.toThrow();
  });

  it("rejects duplicate normalized lines from the same source", () => {
    const ws = validWorkspace();
    const second = { ...ws.records[0], id: "record-2", company: "  acme   FUEL ", quantity: 100.0 };
    expect(() => validateWorkspace({ ...ws, records: [...ws.records, second] })).toThrow(/Duplicate normalized volume lines/);
    const other = { ...second, quantity: 101 };
    expect(() => validateWorkspace({ ...ws, records: [...ws.records, other] })).not.toThrow();
  });

  it("rejects records that would break calculations", () => {
    expect(() => validateWorkspace(withRecord({ fuels: ["Diesel", "Gasoline"], role: "customer" }))).toThrow(/one product/);
    expect(() => validateWorkspace(withRecord({ validFrom: "2026-06-01", validUntil: "2026-05-31" }))).toThrow(/validUntil/);
  });

  it("rejects dangling sourceIds and bad document metadata", () => {
    expect(() => validateWorkspace(withRecord({ sourceId: "missing" }))).toThrow(/sourceId/);
    const ws = validWorkspace();
    const bad = (doc: Record<string, unknown>) => ({ ...ws, documents: [{ ...ws.documents[0], ...doc }] });
    expect(() => validateWorkspace(bad({ name: " " }))).toThrow(/document name/);
    expect(() => validateWorkspace(bad({ text: 5 }))).toThrow(/text must be a string/);
    expect(() => validateWorkspace(bad({ warnings: [1] }))).toThrow(/warnings/);
    const twice = { ...ws, documents: [ws.documents[0], { id: "document-1", name: "b.pdf" }] };
    expect(() => validateWorkspace(twice)).toThrow(/Duplicate document IDs/);
  });

  it("does not mutate the input workspace", () => {
    const ws = validWorkspace();
    const snapshot = structuredClone(ws);
    const out = validateWorkspace(ws);
    expect(ws).toEqual(snapshot);
    expect(out.documents[0]).not.toBe(ws.documents[0]);
  });
});

describe("normalization helpers", () => {
  it("formats numbers like Decimal.normalize()", () => {
    expect(normalNumber(120000.0)).toBe("120000");
    expect(normalNumber(0.5)).toBe("0.5");
    expect(normalNumber(1e-7)).toBe("0.0000001");
    expect(normalNumber(null)).toBe("");
    expect(normalNumber(0)).toBe("0");
    expect(normalNumber(1.5e22)).toBe("15000000000000000000000");
    expect(normalNumber(1375999.6299312)).toBe("1375999.6299312");
  });

  it("builds case/space-insensitive line keys", () => {
    const a = validateRecord({ id: "1", company: " Acme  Fuel", role: "supplier", fuels: ["Gasoline", "Diesel"], quantity: 100, unit: "L", period: "monthly" });
    const b: SenerRecord = { ...a, company: "acme fuel", fuels: ["Diesel", "Gasoline"], quantity: 100.0 };
    expect(normalizedLineKey(a)).toBe(normalizedLineKey(b));
    expect(normalizedLineKey(a)).toBe("acme fuel~supplier~diesel|gasoline~100~l~monthly");
  });

  it("normalizes company names with python casefold semantics", () => {
    expect(normalizeCompany("  Straße\tGmbH  ")).toBe("strasse gmbh");
    expect(casefold("ΣΑΣ")).toBe("σασ");
  });
});
