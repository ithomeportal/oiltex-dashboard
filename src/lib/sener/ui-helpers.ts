// SENER UI helpers — pure formatting, sorting and record helpers ported from
// the Manus app (app.js, table-sort.js, register-sort.js, customer-splits.js,
// customer-register.js, document-intake.js). No React, no fetch.

import {
  BASE_FUELS,
  HORIZONS,
  LITERS_PER_GALLON,
  type Horizon,
  type Role,
  type SenerDocument,
  type SenerRecord,
  type SenerWorkspace,
} from "./types";
import { monthlyLiters } from "./calculator";

export const G = LITERS_PER_GALLON;
export const ALL_PRODUCTS = "All products";
export const OILTEX_RED = "#D4222E";

export const ROLE_LABEL: Record<Role, string> = {
  supplier: "Supplier",
  transport: "Transport",
  customer: "Customer",
};
export const STAGE_LABEL: Record<Role, string> = {
  supplier: "Supply",
  transport: "Transport",
  customer: "Demand",
};

/** A register entry may be a real record or a derived "pending customer LOI" row. */
export type RegisterEntry = SenerRecord & { pendingDocument?: boolean };

// ---- formatting -------------------------------------------------------------

export function num(value: number, dec = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: dec,
    minimumFractionDigits: dec,
  }).format(Number.isFinite(value) ? value : 0);
}

export function short(value: number): string {
  if (value >= 1e6) return num(value / 1e6, 2) + "M";
  if (value >= 1e3) return num(value / 1e3, 1) + "K";
  return num(value);
}

export function monogram(company: string): string {
  return company
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function periodInfo(horizon: Horizon) {
  return HORIZONS[horizon] ?? HORIZONS.monthly;
}

export function projectionNote(horizon: Horizon): string {
  const p = periodInfo(horizon);
  return p.months === 1
    ? "Monthly planning rates from currently valid records. Source quantities are unchanged."
    : `${p.label} projection: monthly recurring rates × ${p.months}. Assumes rates continue for the whole period; does not prorate expiry dates or select calendar quarters/semesters. Source quantities are unchanged.`;
}

// ---- record volume / status -------------------------------------------------

/** Monthly liters for a record — delegates to the shared calculator so the register never drifts from balances. */
export function monthLiters(r: SenerRecord, today: string): number {
  return monthlyLiters(r, today);
}

export function reportedLiters(r: SenerRecord, months: number, today: string): number {
  return monthLiters(r, today) * months;
}

export function recordStatus(r: RegisterEntry, months: number, today: string): string {
  if (r.pendingDocument) return "Needs volume review";
  if (r.status === "draft") return "Needs review";
  if (r.status === "inactive") return "Inactive";
  if (r.validUntil && r.validUntil < today) return "Expired";
  if (r.validFrom && r.validFrom > today) return "Future validity";
  return reportedLiters(r, months, today) ? "Included" : "Missing/one-time period";
}

export function candidateKey(r: SenerRecord): string {
  return [
    (r.company || "").trim().toLowerCase(),
    r.role,
    [...(r.fuels || [])].sort().join("|"),
    r.quantity,
    r.unit,
    r.period,
  ].join("~");
}

/** Same rules as app.js validateDocumentIndex — throws on a register that could double-count. */
export function validateDocumentIndex(workspace: SenerWorkspace): void {
  const ids = new Set<string>();
  const hashes = new Set<string>();
  const prints = new Set<string>();
  for (const doc of workspace.documents) {
    if (!doc || typeof doc.id !== "string" || typeof doc.name !== "string" || ids.has(doc.id)) {
      throw new Error("Duplicate or invalid document IDs.");
    }
    ids.add(doc.id);
    for (const [field, set] of [
      ["hash", hashes],
      ["fingerprint", prints],
    ] as const) {
      const value = doc[field];
      if (value) {
        if (!/^[a-f0-9]{64}$/.test(value) || set.has(value)) {
          throw new Error(`Duplicate or invalid document ${field}. This backup could double-count volumes.`);
        }
        set.add(value);
      }
    }
    if ((doc.text && typeof doc.text !== "string") || !Array.isArray(doc.warnings || [])) {
      throw new Error("Invalid document metadata.");
    }
  }
  const lineKeys = new Set<string>();
  for (const r of workspace.records) {
    if (r.sourceId && !ids.has(r.sourceId)) throw new Error("A volume refers to a missing document.");
    if (r.sourceId) {
      const key = r.sourceId + "~" + candidateKey(r);
      if (lineKeys.has(key)) throw new Error("Duplicate volume lines from the same document.");
      lineKeys.add(key);
    }
  }
}

// ---- fuels ------------------------------------------------------------------

export function customFuels(records: readonly SenerRecord[]): string[] {
  return [...new Set(records.flatMap((r) => r.fuels || []).filter((f) => f.startsWith("Other: ")))];
}

/** Base fuels (incl. generic "Other") + any exact `Other: X` products present. */
export function fuelOptions(records: readonly SenerRecord[], extra: readonly string[] = []): string[] {
  const custom = customFuels(records);
  const more = extra.filter((f) => f.startsWith("Other: ") && !custom.includes(f));
  return [...BASE_FUELS, ...custom, ...more];
}

export const EXACT_OTHER_RE = /^[A-Za-z0-9][A-Za-z0-9 /()._-]{1,70}$/;

// ---- sorting (table-sort.js / register-sort.js) -----------------------------

export interface SortState {
  key: string | null;
  direction: "asc" | "desc";
}
export const NO_SORT: SortState = { key: null, direction: "asc" };

export function toggleSort(current: SortState, key: string): SortState {
  return { key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" };
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export interface SortColumn<T> {
  type: "text" | "number";
  value: (row: T) => string | number | null | undefined;
}

function isMissing(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v));
}

/** Stable sort on a copy; missing values always last; asc→desc toggle. */
export function sortRows<T>(rows: readonly T[], sort: SortState, columns: Record<string, SortColumn<T>>): T[] {
  const def = sort.key ? columns[sort.key] : undefined;
  if (!def) return [...rows];
  const dir = sort.direction === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: def.value(row) }))
    .sort((a, b) => {
      const ma = isMissing(a.value);
      const mb = isMissing(b.value);
      if (ma !== mb) return ma ? 1 : -1;
      if (ma) return a.index - b.index;
      const order =
        def.type === "number"
          ? Number(a.value) - Number(b.value)
          : collator.compare(String(a.value), String(b.value));
      return order ? dir * order : a.index - b.index;
    })
    .map((e) => e.row);
}

/** register-sort.js: multi-value keys, stable ties. */
export function sortRegister(
  rows: readonly RegisterEntry[],
  sort: SortState,
  volume: (r: RegisterEntry) => number,
  status: (r: RegisterEntry) => string,
): RegisterEntry[] {
  const valuesOf = (r: RegisterEntry): (string | number)[] => {
    switch (sort.key) {
      case "company":
        return [r.company || "", r.location || "Location not recorded"];
      case "stage":
        return [ROLE_LABEL[r.role] || r.role || "", (r.fuels || []).join(" · ")];
      case "volume":
        return [volume(r)];
      case "agreement":
        return [r.agreement || "Non-binding LOI"];
      case "status":
        return [status(r)];
      default:
        return [];
    }
  };
  if (!sort.key || !["company", "stage", "volume", "agreement", "status"].includes(sort.key)) return [...rows];
  const dir = sort.direction === "desc" ? -1 : 1;
  return rows
    .map((record, index) => ({ record, index, values: valuesOf(record) }))
    .sort((a, b) => {
      for (let i = 0; i < a.values.length; i++) {
        const order =
          sort.key === "volume"
            ? Number(a.values[i]) - Number(b.values[i])
            : collator.compare(String(a.values[i]), String(b.values[i]));
        if (order) return dir * order;
      }
      return a.index - b.index;
    })
    .map((e) => e.record);
}

// ---- customer splits (customer-splits.js) -----------------------------------

export function parseQuantity(value: unknown): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) {
    throw new Error("Enter a non-negative quantity, e.g. 23,350 or 23350.50.");
  }
  const n = Number(text.replaceAll(",", ""));
  if (!Number.isFinite(n) || n > 1e13) throw new Error("Each quantity must be at most 10,000,000,000,000.");
  return n;
}

export const normCompany = (value: unknown): string =>
  String(value || "").trim().replace(/\s+/g, " ").toLowerCase();

export function splitIdentity(r: SenerRecord) {
  return {
    groupId: r.splitGroupId || "",
    company: normCompany(r.company),
    sourceId: r.sourceId || "",
    role: r.role,
  };
}

export function groupRows(record: SenerRecord, source: readonly SenerRecord[]): SenerRecord[] {
  const anchor = source.find((row) => row.id === record.id) || record;
  if (!anchor.splitGroupId) return [anchor];
  return source.filter(
    (row) =>
      row.role === "customer" &&
      row.splitGroupId === anchor.splitGroupId &&
      normCompany(row.company) === normCompany(anchor.company) &&
      (row.sourceId || "") === (anchor.sourceId || ""),
  );
}

/** Replace target ids with replacements at the first target's position (append if none). */
export function replaceRows<T extends { id: string }>(rows: readonly T[], ids: readonly string[], replacements: readonly T[]): T[] {
  const targets = new Set(ids);
  const result: T[] = [];
  let inserted = false;
  for (const row of rows) {
    if (targets.has(row.id)) {
      if (!inserted) {
        result.push(...replacements);
        inserted = true;
      }
    } else result.push(row);
  }
  if (!inserted) result.push(...replacements);
  return result;
}

// ---- documents --------------------------------------------------------------

export function linkedRecords(ws: SenerWorkspace, docId: string): SenerRecord[] {
  return ws.records.filter((r) => r.sourceId === docId);
}

export function documentStatusLabel(doc: SenerDocument, linkedCount: number): string {
  if (!doc.reviewStatus) return "Reviewed extraction · shared original";
  if (linkedCount) return `Registered · ${linkedCount} volume line(s)`;
  switch (doc.reviewStatus) {
    case "uploading":
      return "Upload started · original not yet confirmed";
    case "upload_failed":
      return "Original upload failed · reattach or retry";
    case "analyzing":
      return "Shared upload · analysis in progress";
    case "analysis_failed":
      return "Shared upload · analysis failed · review/retry needed";
    case "duplicate":
      return "Duplicate content · not counted";
    default:
      return "Shared upload · pending review · not counted";
  }
}

export function pendingUploads(ws: SenerWorkspace): SenerDocument[] {
  return ws.documents.filter(
    (d) => d.reviewStatus && d.reviewStatus !== "duplicate" && !ws.records.some((r) => r.sourceId === d.id),
  );
}

// ---- files / browser --------------------------------------------------------

export const ACCEPTED_EXT_RE = /\.(pdf|docx|txt|md|png|jpe?g|webp)$/i;
export const ACCEPT_ATTR = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function extOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
