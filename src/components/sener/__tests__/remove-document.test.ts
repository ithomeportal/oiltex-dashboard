import { describe, expect, it } from "vitest";
import type { SenerDocument, SenerRecord, SenerWorkspace } from "@/lib/sener/types";
import { EMPTY_WORKSPACE } from "@/lib/sener/types";
import {
  ANALYSIS_LOCK_MS,
  DocumentInFlightError,
  DocumentRegisteredError,
  DocumentRemovedError,
  isInFlight,
  removeDocumentMutator,
} from "../intake-ops";

const doc = (id: string, extra: Partial<SenerDocument> = {}): SenerDocument =>
  ({ id, name: `${id}.pdf`, reviewStatus: "analysis_failed", ...extra }) as SenerDocument;

const record = (id: string, sourceId: string): SenerRecord =>
  ({ id, company: "ACME", role: "supplier", fuels: ["Diesel"], quantity: 1, unit: "gal", period: "monthly", status: "active", sourceId }) as SenerRecord;

const workspace = (documents: SenerDocument[], records: SenerRecord[] = []): SenerWorkspace => ({
  ...EMPTY_WORKSPACE,
  documents,
  records,
});

describe("removeDocumentMutator", () => {
  it("removes an unregistered document and keeps the others", () => {
    const ws = workspace([doc("a"), doc("b"), doc("c")], [record("r1", "b")]);
    const next = removeDocumentMutator("a")(ws);
    expect(next.documents.map((d) => d.id)).toEqual(["b", "c"]);
    expect(next.records).toBe(ws.records);
  });

  it("does not mutate the input workspace", () => {
    const ws = workspace([doc("a"), doc("b")]);
    removeDocumentMutator("a")(ws);
    expect(ws.documents.map((d) => d.id)).toEqual(["a", "b"]);
  });

  it("refuses a document that has registered records", () => {
    const ws = workspace([doc("a", { reviewStatus: "pending_review" })], [record("r1", "a")]);
    expect(() => removeDocumentMutator("a")(ws)).toThrow(DocumentRegisteredError);
  });

  it("reports a document that is already gone", () => {
    expect(() => removeDocumentMutator("missing")(workspace([doc("a")]))).toThrow(DocumentRemovedError);
  });

  it("refuses a document another visitor is still analysing", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    const started = new Date(now - 60_000).toISOString();
    const ws = workspace([doc("a", { reviewStatus: "analyzing", analysisStarted: started })]);
    expect(() => removeDocumentMutator("a", now)(ws)).toThrow(DocumentInFlightError);
  });

  it("allows removing an upload whose lock has expired", () => {
    const now = Date.parse("2026-10-28T12:00:00Z");
    const created = new Date(now - ANALYSIS_LOCK_MS - 1).toISOString();
    const ws = workspace([doc("a", { reviewStatus: "uploading", created }), doc("b")]);
    expect(removeDocumentMutator("a", now)(ws).documents.map((d) => d.id)).toEqual(["b"]);
  });
});

describe("isInFlight", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  it("is false for settled statuses", () => {
    expect(isInFlight(doc("a", { reviewStatus: "analysis_failed" }), now)).toBe(false);
    expect(isInFlight(doc("a", { reviewStatus: "pending_review" }), now)).toBe(false);
  });
  it("lets an upload with an unreadable timestamp be removed", () => {
    expect(isInFlight(doc("a", { reviewStatus: "uploading", created: "bad" }), now)).toBe(false);
  });
});
