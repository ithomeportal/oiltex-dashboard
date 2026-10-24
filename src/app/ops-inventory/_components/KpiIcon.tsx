export type KpiIconKind = "loaded" | "net" | "delivered" | "count" | "variance";

const PATHS: Record<KpiIconKind, string> = {
  loaded: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  net: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  delivered: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  count: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  variance: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4",
};

/** Keeps each KPI's original accent colour; the variance icon inherits the tile tone. */
const COLORS: Record<KpiIconKind, string> = {
  loaded: "text-amber-600",
  net: "text-green-600",
  delivered: "text-blue-600",
  count: "text-purple-600",
  variance: "",
};

export function KpiIcon({ kind }: { kind: KpiIconKind }) {
  return (
    <svg className={`w-4 h-4 ${COLORS[kind]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={PATHS[kind]} />
    </svg>
  );
}
