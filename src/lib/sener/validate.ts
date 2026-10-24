// SENER workspace validation — shared by the API routes and the browser.
//
// Exact port of the Manus Python rules: the pydantic `Record` model
// (server/app.py), `validate_split_groups` (server/customer_splits.py) and
// `validate_workspace` (server/shared_api.py). Pure: inputs are never mutated;
// every validator returns a fresh normalized copy.

import {
  BASE_FUELS,
  CUSTOM_FUEL_RE,
  MAX_ITEMS,
  ROLES,
  type SenerDocument,
  type SenerRecord,
  type SenerWorkspace,
} from "./types";

export class SenerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SenerValidationError";
  }
}

const fail = (message: string): never => {
  throw new SenerValidationError(message);
};

// ---- text helpers (python str.split / casefold semantics) ------------------

/** Characters python's `str.split()` treats as whitespace (`str.isspace`). */
const PY_WHITESPACE =
  /[\t\n\v\f\r \x1c-\x1f\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g;

const FULL_CASE_FOLDS: Record<string, string> = {
  "\u00df": "ss",
  "\u03c2": "\u03c3",
  "\ufb00": "ff",
  "\ufb01": "fi",
  "\ufb02": "fl",
  "\ufb03": "ffi",
  "\ufb04": "ffl",
  "\ufb05": "st",
  "\ufb06": "st",
};

/** `" ".join(s.split())` */
export function collapseWhitespace(value: string): string {
  return value.replace(PY_WHITESPACE, " ").replace(/^ +| +$/g, "");
}

/** Approximates python `str.casefold()` (lowercase plus the common full folds). */
export function casefold(value: string): string {
  return value.toLowerCase().replace(/[\u00df\u03c2\ufb00-\ufb06]/g, (ch) => FULL_CASE_FOLDS[ch] ?? ch);
}

/** Company identity used for customer counting: whitespace collapse + casefold. */
export function normalizeCompany(value: string): string {
  return casefold(collapseWhitespace(value));
}

/** Python `len()` counts code points, not UTF-16 units. */
const pyLen = (value: string): number => Array.from(value).length;

/** Python `sorted()` on strings: code-point order. */
export function compareCodePoints(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const d = (x[i].codePointAt(0) ?? 0) - (y[i].codePointAt(0) ?? 0);
    if (d !== 0) return d;
  }
  return x.length - y.length;
}

// ---- record model ----------------------------------------------------------

export function isValidFuel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ((BASE_FUELS as readonly string[]).includes(value) || CUSTOM_FUEL_RE.test(value))
  );
}

/** `date.fromisoformat` restricted to the YYYY-MM-DD spelling the app writes. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 1 || m < 1 || m > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= days;
}

const ALLOWED: Record<"unit" | "period" | "status", readonly string[]> = {
  unit: ["gal", "L", "unknown"],
  period: ["monthly", "daily", "weekly", "annual", "one-time", "unknown"],
  status: ["active", "draft", "inactive"],
};
const DEFAULTS = { unit: "unknown", period: "unknown", status: "draft" } as const;
const DECLARED = [
  "id", "company", "role", "fuels", "quantity", "unit", "period", "status", "validFrom", "validUntil",
];
const NUMERIC_STRING = /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const has = (raw: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(raw, key) && raw[key] !== undefined;

function requireString(raw: Record<string, unknown>, key: string, min: number, max: number): string {
  if (!has(raw, key)) return fail(`Invalid record: ${key} is required.`);
  const value = raw[key];
  if (typeof value !== "string") return fail(`Invalid record: ${key} must be a string.`);
  const len = pyLen(value);
  if (len < min) return fail(`Invalid record: ${key} must have at least ${min} character(s).`);
  if (len > max) return fail(`Invalid record: ${key} must have at most ${max} characters.`);
  return value;
}

function parseRole(raw: Record<string, unknown>): SenerRecord["role"] {
  const role = requireString(raw, "role", 0, Infinity);
  if (!(ROLES as readonly string[]).includes(role)) fail("Invalid record: Unknown counterparty role");
  return role as SenerRecord["role"];
}

function parseFuels(raw: Record<string, unknown>): string[] {
  if (!has(raw, "fuels")) return fail("Invalid record: fuels is required.");
  const fuels = raw.fuels;
  if (!Array.isArray(fuels)) return fail("Invalid record: fuels must be a list.");
  if (fuels.length < 1 || fuels.length > 6) fail("Invalid record: fuels must list 1 to 6 products.");
  if (fuels.some((f) => typeof f !== "string")) fail("Invalid record: each fuel must be a string.");
  if (fuels.some((f) => !isValidFuel(f)) || new Set(fuels).size !== fuels.length) {
    fail("Invalid record: Unknown or duplicated product");
  }
  return [...(fuels as string[])];
}

/** pydantic `float | None` in lax mode: numbers, numeric strings and booleans coerce. */
function parseQuantity(raw: Record<string, unknown>): number | null {
  const value = raw.quantity;
  if (value === undefined || value === null) return null;
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "boolean") n = value ? 1 : 0;
  else if (typeof value === "string" && NUMERIC_STRING.test(value)) n = Number(value.trim());
  else return fail("Invalid record: quantity must be a number.");
  if (!Number.isFinite(n)) fail("Invalid record: quantity must be a finite number.");
  if (n < 0) fail("Invalid record: quantity must be greater than or equal to 0.");
  if (n > 1e13) fail("Invalid record: quantity must be less than or equal to 1e13.");
  return n;
}

function parseChoice(raw: Record<string, unknown>, key: keyof typeof ALLOWED): string {
  if (!has(raw, key)) return DEFAULTS[key];
  const value = raw[key];
  if (typeof value !== "string") return fail(`Invalid record: ${key} must be a string.`);
  if (!ALLOWED[key].includes(value)) fail(`Invalid record: Unknown ${key}`);
  return value;
}

function parseDate(raw: Record<string, unknown>, key: "validFrom" | "validUntil"): string {
  if (!has(raw, key)) return "";
  const value = raw[key];
  if (typeof value !== "string") return fail(`Invalid record: ${key} must be a string.`);
  if (value && !isIsoDate(value)) fail(`Invalid record: ${key} must be a YYYY-MM-DD date.`);
  return value;
}

function extras(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!DECLARED.includes(key) && value !== undefined) out[key] = structuredClone(value);
  }
  return out;
}

/** Port of the pydantic `Record` model (extra='allow'); declared fields first, then extras. */
export function validateRecord(raw: unknown): SenerRecord {
  if (!isObject(raw)) return fail("Invalid record: each record must be an object.");
  const declared = {
    id: requireString(raw, "id", 0, 100),
    company: requireString(raw, "company", 1, 300),
    role: parseRole(raw),
    fuels: parseFuels(raw),
    quantity: parseQuantity(raw),
    unit: parseChoice(raw, "unit") as SenerRecord["unit"],
    period: parseChoice(raw, "period") as SenerRecord["period"],
    status: parseChoice(raw, "status") as SenerRecord["status"],
    validFrom: parseDate(raw, "validFrom"),
    validUntil: parseDate(raw, "validUntil"),
  };
  return { ...declared, ...extras(raw) };
}

// ---- customer split groups -------------------------------------------------

const COMMON_FIELDS: ReadonlyArray<[string, unknown]> = [
  ["period", "unknown"], ["status", "draft"], ["agreement", "Non-binding LOI"],
  ["validFrom", ""], ["validUntil", ""], ["location", ""], ["segment", ""],
  ["stations", null], ["notes", ""],
];

/** Python `==` on JSON values. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => has(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

interface SplitGroup {
  identity: string;
  common: unknown[];
  fuels: Set<string>;
  count: number;
}

const field = (row: Record<string, unknown>, key: string, fallback: unknown): unknown =>
  row[key] === undefined ? fallback : row[key];

function splitIdentity(row: Record<string, unknown>): string {
  const company = typeof row.company === "string" ? row.company : "";
  const source = field(row, "sourceId", "") || "";
  return JSON.stringify([collapseWhitespace(company).toLowerCase(), source]);
}

function checkSplitRow(row: Record<string, unknown>, group: string, groups: Map<string, SplitGroup>): void {
  if (row.role !== "customer" || !Array.isArray(row.fuels) || row.fuels.length !== 1) {
    fail("Split groups must contain only single-product customer records.");
  }
  const identity = splitIdentity(row);
  const common = COMMON_FIELDS.map(([key, fallback]) => field(row, key, fallback));
  const info = groups.get(group) ?? { identity, common, fuels: new Set<string>(), count: 0 };
  groups.set(group, info);
  if (info.identity !== identity) {
    fail("A customer split group cannot combine different companies or source documents.");
  }
  if (!deepEqual(info.common, common)) {
    fail("Split-group period, status, validity and customer details must be the same on every product line.");
  }
  const fuel = casefold(String((row.fuels as unknown[])[0]));
  if (info.fuels.has(fuel)) {
    fail("Duplicate products in a customer split group; combine quantities for the same fuel.");
  }
  info.fuels.add(fuel);
  info.count += 1;
  if (info.count > 30) fail("A customer split group supports at most 30 product lines.");
}

/** Port of `validate_split_groups`; throws `SenerValidationError` on the first violation. */
export function validateSplitGroups(records: readonly SenerRecord[]): void {
  const groups = new Map<string, SplitGroup>();
  for (const row of records) {
    const group: unknown = row.splitGroupId;
    if (group === undefined || group === null || group === "") continue;
    if (typeof group !== "string" || !group.trim() || pyLen(group) > 100) {
      fail("splitGroupId must be a non-empty string of at most 100 characters.");
    }
    checkSplitRow(row, group as string, groups);
  }
}

// ---- documents & workspace -------------------------------------------------

const HASH_RE = /^[a-f0-9]{64}$/;

function identifier(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || pyLen(value) > 100) {
    return fail(`Each ${label} must be a non-empty string of at most 100 characters.`);
  }
  return value;
}

function validateDocument(document: unknown): SenerDocument {
  if (!isObject(document)) return fail("Each document must be an object.");
  identifier(document.id, "document ID");
  const name = document.name;
  if (typeof name !== "string" || !name.trim() || pyLen(name) > 300) {
    fail("Each document name must be a non-empty string of at most 300 characters.");
  }
  for (const key of ["hash", "fingerprint"]) {
    const value = document[key];
    if (value !== undefined && value !== null && value !== "" && !(typeof value === "string" && HASH_RE.test(value))) {
      fail(`Document ${key} values must be lowercase SHA-256 hashes.`);
    }
  }
  if (document.text !== undefined && document.text !== null && typeof document.text !== "string") {
    fail("Document text must be a string.");
  }
  const warnings = document.warnings;
  if (warnings !== undefined && warnings !== null) {
    if (!Array.isArray(warnings) || warnings.some((w) => typeof w !== "string")) {
      fail("Document warnings must be an array of strings.");
    }
  }
  return structuredClone(document) as SenerDocument;
}

/** `format(Decimal(str(x)).normalize(), "f")` for a JS number: plain decimal, no trailing zeros. */
export function normalNumber(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  if (Object.is(value, -0)) return "-0";
  const [mantissa, expPart] = value.toExponential().split("e");
  const negative = mantissa.startsWith("-");
  const digits = mantissa.replace(/^-/, "").replace(".", "").replace(/0+$/, "") || "0";
  const point = Number(expPart) + 1; // position of the decimal point within `digits`
  let plain: string;
  if (point <= 0) plain = "0." + "0".repeat(-point) + digits;
  else if (point >= digits.length) plain = digits + "0".repeat(point - digits.length);
  else plain = digits.slice(0, point) + "." + digits.slice(point);
  return (negative ? "-" : "") + plain;
}

const normalizedText = (value: unknown): string =>
  casefold(collapseWhitespace(value === undefined || value === null ? "None" : String(value)));

/** Port of `_normalized_line_key`: case-, space- and number-spelling-insensitive line identity. */
export function normalizedLineKey(record: SenerRecord): string {
  const fuels = (Array.isArray(record.fuels) ? record.fuels : []).map(normalizedText).sort(compareCodePoints);
  return [
    normalizedText(record.company),
    normalizedText(record.role),
    fuels.join("|"),
    normalNumber(record.quantity),
    normalizedText(record.unit),
    normalizedText(record.period),
  ].join("~");
}

function validateRecords(records: unknown[]): SenerRecord[] {
  const ids = new Set<string>();
  return records.map((raw) => {
    const record = validateRecord(raw);
    const id = identifier(record.id, "record ID");
    if (ids.has(id)) fail("Duplicate record IDs are not allowed in the shared workspace.");
    ids.add(id);
    if (record.role === "customer" && record.fuels.length !== 1) {
      fail("Customer records must have one product per volume line; suppliers and transporters can share a pool.");
    }
    if (record.validFrom && record.validUntil && record.validFrom > record.validUntil) {
      fail("Record validUntil cannot be before validFrom.");
    }
    return record;
  });
}

function validateDocuments(documents: unknown[]): SenerDocument[] {
  const ids = new Set<string>();
  const seen = { hash: new Set<string>(), fingerprint: new Set<string>() };
  const labels = { hash: "document hashes", fingerprint: "document fingerprints" };
  return documents.map((original) => {
    const document = validateDocument(original);
    if (ids.has(document.id)) fail("Duplicate document IDs are not allowed in the shared workspace.");
    ids.add(document.id);
    for (const key of ["hash", "fingerprint"] as const) {
      const value = document[key];
      if (!value) continue;
      if (seen[key].has(value)) fail(`Duplicate ${labels[key]} are not allowed in the shared workspace.`);
      seen[key].add(value);
    }
    return document;
  });
}

function validateSourceLines(records: readonly SenerRecord[], documents: readonly SenerDocument[]): void {
  const documentIds = new Set(documents.map((d) => d.id));
  const keys = new Set<string>();
  for (const record of records) {
    const sourceId: unknown = record.sourceId;
    if (sourceId === undefined || sourceId === null || sourceId === "") continue;
    if (typeof sourceId !== "string" || !documentIds.has(sourceId)) {
      fail("Each record sourceId must refer to a document in this workspace.");
    }
    const key = JSON.stringify([sourceId, normalizedLineKey(record)]);
    if (keys.has(key)) fail("Duplicate normalized volume lines from the same source are not allowed.");
    keys.add(key);
  }
}

/** Port of `validate_workspace`; returns a new normalized workspace or throws. */
export function validateWorkspace(raw: unknown): SenerWorkspace {
  const keys = isObject(raw) ? Object.keys(raw).filter((k) => raw[k] !== undefined) : [];
  if (!isObject(raw) || keys.length !== 3 || !["version", "records", "documents"].every((k) => keys.includes(k))) {
    return fail("Workspace must contain exactly version, records, and documents.");
  }
  if (raw.version !== 1) fail("Only workspace version 1 is supported.");
  const { records, documents } = raw;
  if (!Array.isArray(records) || !Array.isArray(documents)) {
    return fail("Workspace records and documents must be arrays.");
  }
  if (records.length > MAX_ITEMS || documents.length > MAX_ITEMS) {
    fail("A shared workspace may contain at most 2,000 records and 2,000 documents.");
  }
  const normalizedRecords = validateRecords(records);
  validateSplitGroups(normalizedRecords);
  const normalizedDocuments = validateDocuments(documents);
  validateSourceLines(normalizedRecords, normalizedDocuments);
  return { version: 1, records: normalizedRecords, documents: normalizedDocuments };
}
