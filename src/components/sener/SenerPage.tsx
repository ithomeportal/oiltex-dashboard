"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { HORIZONS, type Horizon } from "@/lib/sener/types";
import { ALL_PRODUCTS, pendingUploads, projectionNote } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { BTN_PRIMARY, Icon, Notice } from "./ui";

const HORIZON_OPTIONS: { value: Horizon; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly · 3 months" },
  { value: "semester", label: "Semester · 6 months" },
  { value: "annual", label: "Annual · 12 months" },
];

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** Page header + personal filters + shared notices common to every SENER page. */
export default function SenerPage({ title, subtitle, children }: Props) {
  const { ws, workspace, fuel, setFuel, fuels, horizon, setHorizon, calcError, openUpload } = useSener();
  const pending = pendingUploads(workspace);

  return (
    <>
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold tracking-wider text-slate-400 mb-1">CROSS-BORDER FUEL PLANNING</div>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          <p className="text-slate-500 text-sm mt-1">{subtitle}</p>
        </div>
        <button type="button" onClick={openUpload} className={`${BTN_PRIMARY} inline-flex items-center gap-2`}>
          <Icon name="upload" />
          Upload a letter of intent
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Icon name="layers" />
            <select
              aria-label="Filter by fuel product"
              value={fuel}
              onChange={(e) => setFuel(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800"
            >
              {[ALL_PRODUCTS, ...fuels].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <span>Calculation period</span>
            <select
              aria-label="Calculation period"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as Horizon)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white text-slate-800"
            >
              {HORIZON_OPTIONS.filter((o) => o.value in HORIZONS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-4">{projectionNote(horizon)}</p>

      <div className="space-y-3 mb-6 empty:hidden">
        {ws.loadError && (
          <Notice tone="red">
            Shared workspace could not load: {ws.loadError} Retry with Refresh shared data when the connection is available.
          </Notice>
        )}
        {calcError && <Notice tone="red">{calcError}</Notice>}
        {pending.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <div className="text-sm text-amber-900">
              <strong className="block">
                {pending.length} uploaded LOI{pending.length === 1 ? "" : "s"} awaiting review
              </strong>
              <span>Already visible to everyone. Unconfirmed volumes are NOT included in supply, transport or demand.</span>
            </div>
            <Link href="/sener/documents" className={BTN_PRIMARY}>
              Review uploaded LOIs
            </Link>
          </div>
        )}
      </div>

      {/* Never render zero totals as "Balanced/Covered" before the first load. */}
      {ws.envelope ? (
        children
      ) : (
        !ws.loadError && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center text-slate-500">
            Loading shared SENER data…
          </div>
        )
      )}

      <footer className="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
        <span className="font-semibold tracking-wider text-slate-600">OIL TEX · PERMIT MATCH</span>
        <span>Volume planning only. Product eligibility, physical routes and permit requirements need separate review.</span>
      </footer>
    </>
  );
}
