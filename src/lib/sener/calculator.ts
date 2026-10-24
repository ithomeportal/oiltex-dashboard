// SENER volume calculator — exact port of the Manus server/calculator.py.
//
// Recurring planning volumes with shared supplier and transport capacities,
// matched through an Edmonds–Karp max-flow. Node names, `sorted(neighbors)`
// iteration, insertion order and float operation order follow the Python code
// so results agree to the last bit (see __tests__/golden.test.ts). Pure: no I/O,
// inputs are never mutated.

import {
  HORIZONS,
  LITERS_PER_GALLON,
  ROLES,
  type Allocation,
  type CalculateOptions,
  type CalculationResult,
  type FuelBalance,
  type Horizon,
  type Role,
  type RoleTotals,
  type SenerRecord,
  type UnmatchedFuel,
} from "./types";
import { compareCodePoints, isIsoDate, isValidFuel, normalizeCompany } from "./validate";

const PERIOD_FACTORS: Record<string, number> = {
  monthly: 1.0,
  daily: 30.0,
  weekly: 52.0 / 12.0,
  annual: 1.0 / 12.0,
};
const ALL_PRODUCTS = "All products";
const RESIDUAL_EPSILON = 1e-7;
const PROJECTION_BASIS =
  "Currently valid recurring monthly rates multiplied by the selected months; no calendar or expiry proration.";
const COVERAGE_BASIS =
  "Matched customer liters divided by total customer demand; not supplier utilization.";

export function currentUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toGallons(liters: number): number {
  return liters / LITERS_PER_GALLON;
}

const sum = (values: Iterable<number>): number => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};

const sortedStrings = (values: Iterable<string>): string[] => [...values].sort(compareCodePoints);

/** Python truthiness of a JSON value (non-empty string/array, non-zero number...). */
const truthy = (value: unknown): boolean =>
  Array.isArray(value) ? value.length > 0 : Boolean(value);

/** Validity window check; any malformed or non-string date zeroes the record. */
function outsideValidity(record: SenerRecord, today: string): boolean {
  for (const [key, future] of [["validFrom", true], ["validUntil", false]] as const) {
    const value: unknown = record[key];
    if (!truthy(value)) continue;
    if (!isIsoDate(value)) return true;
    if ((future && value > today) || (!future && value < today)) return true;
  }
  return false;
}

/** Unknown, one-time, expired and unreviewed records contribute zero. */
export function monthlyLiters(record: SenerRecord, today: string): number {
  if (record.status !== "active") return 0;
  if (outsideValidity(record, today)) return 0;
  const { unit, period } = record;
  if ((unit !== "gal" && unit !== "L") || !Object.prototype.hasOwnProperty.call(PERIOD_FACTORS, period)) {
    return 0;
  }
  const fuels: unknown = record.fuels;
  if (!Array.isArray(fuels) || fuels.length === 0 || fuels.every((f) => f === "Other")) return 0;
  const qty: unknown = record.quantity;
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty < 0) return 0;
  return qty * (unit === "gal" ? LITERS_PER_GALLON : 1) * PERIOD_FACTORS[period];
}

// ---- max-flow --------------------------------------------------------------

interface Pool {
  id: unknown;
  company: unknown;
  fuels: string[]; // eligible fuels only
}
type Entry = readonly [Pool, number];

interface AllocateResult {
  flow: number;
  products: Map<string, number>;
  transports: Allocation[];
  suppliers: Allocation[];
}

/** Residual graph keyed by "a\0b", mirroring python's defaultdict(float) capacity map. */
class FlowGraph {
  readonly capacity = new Map<string, number>();
  private readonly neighbors = new Map<string, Set<string>>();
  private sorted = new Map<string, string[]>();
  original = new Map<string, number>();

  static key(a: string, b: string): string {
    return a + "\u0000" + b;
  }

  cap(a: string, b: string): number {
    return this.capacity.get(FlowGraph.key(a, b)) ?? 0;
  }

  edge(a: string, b: string, amount: number): void {
    const k = FlowGraph.key(a, b);
    this.capacity.set(k, (this.capacity.get(k) ?? 0) + amount);
    this.link(a, b);
    this.link(b, a);
  }

  private link(a: string, b: string): void {
    const set = this.neighbors.get(a) ?? new Set<string>();
    set.add(b);
    this.neighbors.set(a, set);
  }

  /** Freeze topology: snapshot capacities and pre-sort adjacency (it never changes). */
  freeze(): void {
    this.original = new Map(this.capacity);
    this.sorted = new Map([...this.neighbors].map(([n, set]) => [n, sortedStrings(set)]));
  }

  adjacent(node: string): readonly string[] {
    return this.sorted.get(node) ?? [];
  }

  shift(a: string, b: string, amount: number): void {
    this.capacity.set(FlowGraph.key(a, b), this.cap(a, b) - amount);
    this.capacity.set(FlowGraph.key(b, a), this.cap(b, a) + amount);
  }

  used(a: string, b: string): number {
    return Math.max(0, (this.original.get(FlowGraph.key(a, b)) ?? 0) - this.cap(a, b));
  }
}

function buildGraph(suppliers: readonly Entry[], demand: Map<string, number>, transports: readonly Entry[]) {
  const graph = new FlowGraph();
  const fuelSet = new Set<string>(demand.keys());
  for (const [pool] of suppliers) pool.fuels.forEach((f) => fuelSet.add(f));
  fuelSet.delete("Other");
  const fuels = sortedStrings(fuelSet);
  const ceiling = sum(suppliers.map(([, amount]) => amount)) + sum(demand.values()) + 1;
  suppliers.forEach(([pool, amount], i) => {
    const node = "supplier:" + i;
    graph.edge("source", node, amount);
    for (const fuel of pool.fuels) if (fuelSet.has(fuel)) graph.edge(node, "fuel-in:" + fuel, ceiling);
  });
  for (const fuel of fuels) graph.edge("fuel-in:" + fuel, "fuel-out:" + fuel, demand.get(fuel) ?? 0);
  transports.forEach(([pool, amount], i) => {
    const node = "transport:" + i;
    graph.edge(node, "sink", amount);
    for (const fuel of pool.fuels) if (fuelSet.has(fuel)) graph.edge("fuel-out:" + fuel, node, ceiling);
  });
  graph.freeze();
  return { graph, fuels, fuelSet };
}

/** BFS for the shortest augmenting path; returns the parent map or null when none exists. */
function findPath(graph: FlowGraph): Map<string, string> | null {
  const parents = new Map<string, string>([["source", ""]]);
  const queue = ["source"];
  let head = 0;
  while (head < queue.length && !parents.has("sink")) {
    const a = queue[head++];
    for (const b of graph.adjacent(a)) {
      if (!parents.has(b) && graph.cap(a, b) > RESIDUAL_EPSILON) {
        parents.set(b, a);
        queue.push(b);
      }
    }
  }
  return parents.has("sink") ? parents : null;
}

function augment(graph: FlowGraph, parents: Map<string, string>): number {
  let amount = Infinity;
  for (let node = "sink"; node !== "source"; node = parents.get(node) as string) {
    amount = Math.min(amount, graph.cap(parents.get(node) as string, node));
  }
  for (let node = "sink"; node !== "source"; node = parents.get(node) as string) {
    graph.shift(parents.get(node) as string, node, amount);
  }
  return amount;
}

function allocations(graph: FlowGraph, entries: readonly Entry[], fuelSet: Set<string>, kind: "supplier" | "transport"): Allocation[] {
  return entries.map(([pool], i) => {
    const node = kind + ":" + i;
    const byFuel: Record<string, number> = {};
    for (const f of pool.fuels) {
      if (!fuelSet.has(f)) continue;
      byFuel[f] = kind === "supplier" ? graph.used(node, "fuel-in:" + f) : graph.used("fuel-out:" + f, node);
    }
    const liters = kind === "supplier" ? graph.used("source", node) : graph.used(node, "sink");
    return { id: pool.id as string, company: pool.company as string, liters, byFuel };
  });
}

/** Source -> capped supplier -> capped product demand -> capped transport -> sink. */
function allocate(suppliers: readonly Entry[], demand: Map<string, number>, transports: readonly Entry[]): AllocateResult {
  const { graph, fuels, fuelSet } = buildGraph(suppliers, demand, transports);
  let flow = 0.0;
  for (let parents = findPath(graph); parents; parents = findPath(graph)) flow += augment(graph, parents);
  const products = new Map(fuels.map((f) => [f, graph.used("fuel-in:" + f, "fuel-out:" + f)] as const));
  return {
    flow,
    products,
    suppliers: allocations(graph, suppliers, fuelSet, "supplier"),
    transports: allocations(graph, transports, fuelSet, "transport"),
  };
}

// ---- aggregation -----------------------------------------------------------

const roleTotals = (fn: (role: Role) => number): RoleTotals =>
  Object.fromEntries(ROLES.map((r) => [r, fn(r)])) as RoleTotals;

function scenarioFactor(factors: CalculateOptions["factors"], role: Role): number {
  const factor: unknown = factors?.[role] ?? 1;
  if (typeof factor !== "number" || !Number.isFinite(factor) || factor < 0 || factor > 3) return 1;
  return factor;
}

const addTo = (map: Map<string, number>, key: string, amount: number): void => {
  map.set(key, (map.get(key) ?? 0) + amount);
};

interface Tally {
  supply: Map<string, number>;
  sharedSupply: Map<string, number>;
  demand: Map<string, number>;
  totals: RoleTotals;
  contract: RoleTotals;
  counts: RoleTotals;
  activeCounts: RoleTotals;
  excluded: string[];
  suppliers: Entry[];
  transports: Entry[];
  customerCompanies: Set<unknown>;
  activeCustomerCompanies: Set<unknown>;
  customersByFuel: Map<string, Set<unknown>>;
  customerLinesByFuel: Map<string, number>;
}

function emptyTally(): Tally {
  return {
    supply: new Map(), sharedSupply: new Map(), demand: new Map(),
    totals: roleTotals(() => 0), contract: roleTotals(() => 0),
    counts: roleTotals(() => 0), activeCounts: roleTotals(() => 0),
    excluded: [], suppliers: [], transports: [],
    customerCompanies: new Set(), activeCustomerCompanies: new Set(),
    customersByFuel: new Map(), customerLinesByFuel: new Map(),
  };
}

function tallyCustomer(t: Tally, record: SenerRecord, fuels: string[], amount: number): void {
  const company = typeof record.company === "string" ? record.company : "";
  const key: unknown = normalizeCompany(company) || record.id;
  t.customerCompanies.add(key);
  if (amount <= 0) return;
  t.activeCustomerCompanies.add(key);
  for (const f of fuels) {
    const set = t.customersByFuel.get(f) ?? new Set<unknown>();
    set.add(key);
    t.customersByFuel.set(f, set);
    addTo(t.customerLinesByFuel, f, 1);
  }
}

function tallyRecord(t: Tally, record: SenerRecord, ctx: { factors: CalculateOptions["factors"]; fuel: string; months: number; today: string }): void {
  const role = record.role as Role;
  const fuels: string[] = Array.isArray(record.fuels) ? record.fuels : [];
  if (!(ROLES as readonly unknown[]).includes(role) || fuels.length === 0) {
    t.excluded.push(record.id);
    return;
  }
  if (ctx.fuel !== ALL_PRODUCTS && !fuels.includes(ctx.fuel)) return;
  const base = monthlyLiters(record, ctx.today);
  if (role === "customer") tallyCustomer(t, record, fuels, base);
  if (base === 0) t.excluded.push(record.id);
  else t.activeCounts[role] += 1;
  const amount = base * (scenarioFactor(ctx.factors, role) * ctx.months);
  t.totals[role] += amount;
  t.counts[role] += 1;
  if (record.agreement === "Contract") t.contract[role] += amount;
  const eligible = fuels.filter((f) => f !== "Other" && (ctx.fuel === ALL_PRODUCTS || f === ctx.fuel));
  const pool: Pool = { id: record.id, company: record.company, fuels: eligible };
  if (role === "transport") t.transports.push([pool, amount]);
  else if (role === "supplier") {
    t.suppliers.push([pool, amount]);
    const shared = fuels.filter((f) => f !== "Other").length > 1;
    for (const f of eligible) {
      // Per-product eligible capacity is overlapping, NOT additive across pools.
      addTo(t.supply, f, amount);
      if (shared) addTo(t.sharedSupply, f, amount);
    }
  } else if (eligible.length > 0) addTo(t.demand, eligible[0], amount);
}

function resolveHorizon(horizon: string): Horizon {
  if (!Object.prototype.hasOwnProperty.call(HORIZONS, horizon)) throw new Error("Unknown calculation period");
  return horizon as Horizon;
}

function unmatched(t: Tally, products: Map<string, number>, allFuels: string[]): UnmatchedFuel[] {
  return allFuels
    .filter((f) => (t.demand.get(f) ?? 0) - (products.get(f) ?? 0) > 0.1)
    .map((f) => ({
      fuel: f,
      liters: Math.max(0, (t.demand.get(f) ?? 0) - (products.get(f) ?? 0)),
      eligibleSupply: t.supply.get(f) ?? 0,
      eligibleTransport: sum(t.transports.filter(([p]) => p.fuels.includes(f)).map(([, a]) => a)),
    }));
}

function fuelBalances(t: Tally, products: Map<string, number>, allFuels: string[]): FuelBalance[] {
  return allFuels
    .filter((f) => (t.supply.get(f) ?? 0) || (t.demand.get(f) ?? 0))
    .map((f) => ({
      fuel: f,
      supply: t.supply.get(f) ?? 0,
      sharedSupply: t.sharedSupply.get(f) ?? 0,
      demand: t.demand.get(f) ?? 0,
      matched: products.get(f) ?? 0,
      customers: t.customersByFuel.get(f)?.size ?? 0,
      customerLines: t.customerLinesByFuel.get(f) ?? 0,
    }));
}

function bottlenecksFor(totals: RoleTotals, matched: number, lowest: number): string[] {
  if (matched + 0.1 < lowest) return ["product compatibility"];
  return ROLES.filter((r) => Math.abs(totals[r] - lowest) < 0.1);
}

function coverage(matched: number, uncovered: number, demand: number): number {
  if (!demand) return 0;
  return uncovered === 0 ? 100 : Math.min(100, (matched / demand) * 100);
}

export function calculate(records: readonly SenerRecord[], opts: CalculateOptions = {}): CalculationResult {
  const horizon = resolveHorizon(opts.horizon ?? "monthly");
  const fuel = opts.fuel ?? ALL_PRODUCTS;
  if (fuel !== ALL_PRODUCTS && !isValidFuel(fuel)) throw new Error("Unknown fuel filter");
  const { months, label } = HORIZONS[horizon];
  const ctx = { factors: opts.factors, fuel, months, today: opts.today ?? currentUtcDate() };
  const t = emptyTally();
  for (const record of records) tallyRecord(t, record, ctx);

  const { flow: matched, products, transports, suppliers } = allocate(t.suppliers, t.demand, t.transports);
  const allFuels = sortedStrings(new Set([...t.supply.keys(), ...t.demand.keys()]));
  const unrestricted: Entry[] = [[{ id: "unrestricted", company: undefined, fuels: allFuels }, sum(t.demand.values()) + 1]];
  const eligible = allocate(t.suppliers, t.demand, unrestricted).flow;
  const { totals } = t;
  const lowest = Math.min(...ROLES.map((r) => totals[r]));
  const rawUncovered = Math.max(0, totals.customer - matched);
  const uncovered = rawUncovered < 1e-6 ? 0.0 : rawUncovered;

  return {
    horizon, months, periodLabel: label, projectionBasis: PROJECTION_BASIS,
    totals: { ...totals }, gallons: roleTotals((r) => totals[r] / LITERS_PER_GALLON),
    matchedLiters: matched, matchedGallons: matched / LITERS_PER_GALLON,
    demandCoverage: coverage(matched, uncovered, totals.customer),
    aggregateVolumeCoverage: totals.customer ? Math.min(100, (lowest / totals.customer) * 100) : 0,
    coverageBasis: COVERAGE_BASIS,
    unused: roleTotals((r) => Math.max(0, totals[r] - matched)),
    gapsToDemand: roleTotals((r) => Math.max(0, totals.customer - totals[r])),
    uncoveredDemand: uncovered, unmatchedByFuel: unmatched(t, products, allFuels),
    productConstraintGap: Math.max(0, lowest - matched),
    eligibleProductLiters: eligible, contractTotals: { ...t.contract },
    hasSharedSupplierPools: [...t.sharedSupply.values()].some((v) => v > 0),
    byFuel: fuelBalances(t, products, allFuels),
    customerCount: t.customerCompanies.size, activeCustomerCount: t.activeCustomerCompanies.size,
    supplierAllocations: suppliers, transportAllocations: transports,
    counts: { ...t.counts }, activeCounts: { ...t.activeCounts }, excludedIds: [...t.excluded],
    bottlenecks: bottlenecksFor(totals, matched, lowest), conversion: LITERS_PER_GALLON,
  };
}
