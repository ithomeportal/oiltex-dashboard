// SENER permit workspace — shared types.
//
// Ported from the Manus "Oil Tex Permit Match" app (FastAPI + vanilla JS).
// The whole register lives in ONE JSON document (`SenerWorkspace`) guarded by a
// revision number; see src/lib/sener/workspace-db.ts. Field names are kept
// byte-compatible with the Manus export so the migrated data loads unchanged.

export const LITERS_PER_GALLON = 3.785411784; // exact US liquid gallon

export const BASE_FUELS = [
  "Gasoline",
  "Diesel",
  "Naphtha",
  "Jet fuel",
  "Fuel oil",
  "Other",
] as const;

/** A custom product must be spelled exactly `Other: <name>`; bare "Other" never counts. */
export const CUSTOM_FUEL_RE = /^Other: [A-Za-z0-9][A-Za-z0-9 /()._-]{1,70}$/;

export type Role = "supplier" | "transport" | "customer";
export const ROLES: readonly Role[] = ["supplier", "transport", "customer"];

export type Unit = "gal" | "L" | "unknown";
export type Period = "monthly" | "daily" | "weekly" | "annual" | "one-time" | "unknown";
export type RecordStatus = "active" | "draft" | "inactive";
export type Agreement = "Non-binding LOI" | "Contract" | "Unknown";
export type Segment = "Private fleet" | "Station network" | "Other" | "";
export type Confidence = "high" | "medium" | "low";

export interface SenerRecord {
  id: string;
  company: string;
  role: Role;
  fuels: string[]; // customers: exactly one; supplier/transport: 1..6 sharing ONE quantity
  quantity: number | null;
  unit: Unit;
  period: Period;
  status: RecordStatus;
  agreement?: Agreement;
  location?: string;
  segment?: Segment;
  stations?: number | null;
  validFrom?: string; // "" or YYYY-MM-DD
  validUntil?: string;
  notes?: string;
  sourceId?: string; // SenerDocument.id this line was registered from
  sourceName?: string;
  splitGroupId?: string; // customer fuel-split group
  manualSplit?: boolean;
  evidence?: string; // AI extraction quote
  confidence?: Confidence;
  [extra: string]: unknown; // Manus model is extra='allow' — preserve unknown keys
}

export type ReviewStatus =
  | "uploading"
  | "upload_failed"
  | "analyzing"
  | "analysis_failed"
  | "duplicate"
  | "pending_review"
  | "registered";

export interface SenerDocument {
  id: string;
  name: string;
  created?: string; // ISO timestamp
  hash?: string; // sha256 of original bytes (lowercase hex)
  fingerprint?: string; // sha256 of normalized extracted text
  originalAvailable?: boolean;
  originalSize?: number;
  originalMime?: string;
  text?: string; // extracted text, <= 20,000 chars
  warnings?: string[];
  reviewStatus?: ReviewStatus; // absent on legacy (pre-Oct-17) documents = reviewed
  proposedRecords?: SenerRecord[];
  unconfirmedProposals?: SenerRecord[];
  analysisToken?: string;
  analysisStarted?: string;
  analysisCompleted?: string;
  analysisError?: string;
  duplicateOf?: string;
  uploadedBy?: string;
  [extra: string]: unknown;
}

export interface SenerWorkspace {
  version: 1;
  records: SenerRecord[];
  documents: SenerDocument[];
}

export const EMPTY_WORKSPACE: SenerWorkspace = { version: 1, records: [], documents: [] };

export const MAX_ITEMS = 2000;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_DOC_TEXT = 20_000;
export const MAX_AI_TEXT = 100_000;

// ---- calculation -----------------------------------------------------------

export type Horizon = "monthly" | "quarterly" | "semester" | "annual";

export const HORIZONS: Record<Horizon, { label: string; months: number; unit: string }> = {
  monthly: { label: "Monthly", months: 1, unit: "month" },
  quarterly: { label: "Quarterly", months: 3, unit: "quarter" },
  semester: { label: "Semester", months: 6, unit: "semester" },
  annual: { label: "Annual", months: 12, unit: "year" },
};

export type RoleTotals = Record<Role, number>;

export interface Allocation {
  id: string;
  company: string;
  liters: number;
  byFuel: Record<string, number>;
}

export interface FuelBalance {
  fuel: string;
  supply: number; // overlaps across pooled suppliers — NOT additive
  sharedSupply: number;
  demand: number;
  matched: number;
  customers: number; // distinct active legal companies
  customerLines: number;
}

export interface UnmatchedFuel {
  fuel: string;
  liters: number;
  eligibleSupply: number;
  eligibleTransport: number;
}

export interface CalculationResult {
  horizon: Horizon;
  months: number;
  periodLabel: string;
  projectionBasis: string;
  totals: RoleTotals;
  gallons: RoleTotals;
  matchedLiters: number;
  matchedGallons: number;
  demandCoverage: number;
  aggregateVolumeCoverage: number;
  coverageBasis: string;
  unused: RoleTotals;
  gapsToDemand: RoleTotals;
  uncoveredDemand: number;
  unmatchedByFuel: UnmatchedFuel[];
  productConstraintGap: number;
  eligibleProductLiters: number;
  contractTotals: RoleTotals;
  hasSharedSupplierPools: boolean;
  byFuel: FuelBalance[];
  customerCount: number;
  activeCustomerCount: number;
  supplierAllocations: Allocation[];
  transportAllocations: Allocation[];
  counts: RoleTotals;
  activeCounts: RoleTotals;
  excludedIds: string[];
  bottlenecks: string[];
  conversion: number;
}

export interface CalculateOptions {
  factors?: Partial<Record<Role, number>>; // scenario multipliers 0..3
  fuel?: string; // "All products" or a fuel
  horizon?: Horizon;
  today?: string; // YYYY-MM-DD; defaults to the current UTC date
}

// ---- API envelopes ---------------------------------------------------------

export interface WorkspaceEnvelope {
  workspace: SenerWorkspace;
  revision: number;
  updatedAt: string;
  updatedBy: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}
