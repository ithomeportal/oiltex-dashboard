// Chart look & feel shared by every Recharts chart. Spec: docs/SPEC-UI-DESIGN-SYSTEM.md

/** Ordered series palette — first colours are the most distinguishable. */
export const SERIES = {
  blue: "#2563eb",
  cyan: "#0891b2",
  amber: "#d97706",
  violet: "#7c3aed",
  green: "#059669",
  red: "#dc2626",
  slate: "#64748b",
  navy: "#1b3a5c",
} as const;

export const GRID_STROKE = "#eef0f3";
export const AXIS_TICK = { fontSize: 12, fill: "#64748b" } as const;
export const AXIS_LINE = { stroke: "#e5e7eb" } as const;
export const CURSOR = { stroke: "#94a3b8", strokeDasharray: "4 4" } as const;
export const MARGIN = { top: 8, right: 16, bottom: 4, left: 4 } as const;
