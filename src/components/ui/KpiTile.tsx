import type { ReactNode } from "react";
import { CARD } from "./styles";

export type Tone = "default" | "good" | "bad" | "warn" | "accent";

const VALUE_TONE: Record<Tone, string> = {
  default: "text-slate-900",
  good: "text-good",
  bad: "text-bad",
  warn: "text-warn",
  accent: "text-blue-700",
};

const ICON_TONE: Record<Tone, string> = {
  default: "bg-slate-100 text-slate-600",
  good: "bg-emerald-50 text-emerald-600",
  bad: "bg-red-50 text-red-600",
  warn: "bg-amber-50 text-amber-600",
  accent: "bg-blue-50 text-blue-600",
};

interface KpiTileProps {
  label: string;
  value: ReactNode;
  /** Secondary line (delta chip, source, unit). Slot always rendered so tiles share a height. */
  sub?: ReactNode;
  /** Metric definition shown on hover. */
  hint?: string;
  tone?: Tone;
  icon?: ReactNode;
  /** Highlighted tile (e.g. the headline number of the page). */
  emphasis?: boolean;
}

export function KpiTile({ label, value, sub, hint, tone = "default", icon, emphasis = false }: KpiTileProps) {
  const frame = emphasis ? "bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-sm text-white" : CARD;
  return (
    <div className={`${frame} p-4 min-w-0`} title={hint}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-[11px] font-semibold uppercase tracking-wider truncate ${emphasis ? "text-blue-100" : "text-slate-500"}`}>
          {label}
        </p>
        {icon && <span className={`shrink-0 p-1.5 rounded-md ${emphasis ? "bg-white/15 text-white" : ICON_TONE[tone]}`}>{icon}</span>}
      </div>
      <p className={`mt-1.5 text-2xl font-semibold tracking-tight tabular-nums truncate ${emphasis ? "text-white" : VALUE_TONE[tone]}`}>
        {value}
      </p>
      <div className={`mt-1 min-h-4 text-xs truncate ${emphasis ? "text-blue-100" : "text-slate-500"}`}>{sub ?? ""}</div>
    </div>
  );
}

interface DeltaChipProps {
  value: number | null;
  /** Rendered text, e.g. "+0.42 (+0.7%)". */
  children: ReactNode;
  /** When true a decrease is good (costs). */
  goodDown?: boolean;
}

/** Colours by good/bad, not up/down. */
export function DeltaChip({ value, children, goodDown = false }: DeltaChipProps) {
  const flat = value === null || value === 0;
  const good = !flat && (goodDown ? value! < 0 : value! > 0);
  const cls = flat
    ? "bg-slate-100 text-slate-500"
    : good
      ? "bg-emerald-50 text-emerald-700"
      : "bg-red-50 text-red-700";
  const arrow = flat ? "" : value! > 0 ? "▲ " : "▼ ";
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>
      {arrow}
      {children}
    </span>
  );
}
