"use client";

import type { SenerRecord, Unit } from "@/lib/sener/types";
import { num } from "@/lib/sener/ui-helpers";
import { BTN_OUTLINE, BTN_TEXT, INPUT, LABEL } from "./ui";

export interface SplitLine {
  id: string;
  fuel: string;
  quantity: string;
  unit: Unit;
  custom: string;
}

interface Props {
  lines: SplitLine[];
  fuels: string[];
  onChange: (lines: SplitLine[]) => void;
  onAdd: () => void;
  totalText: string;
  previousNote: string;
  baseline: SenerRecord[];
}

export default function SplitBoxes({ lines, fuels, onChange, onAdd, totalText, previousNote, baseline }: Props) {
  const update = (id: string, patch: Partial<SplitLine>) =>
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <section className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Fuel breakdown</h3>
          <p className="text-xs text-slate-500">Add a box for each product and its quantity.</p>
        </div>
        <button type="button" className={BTN_OUTLINE} onClick={onAdd}>
          + Add fuel split
        </button>
      </div>
      {lines.map((line, index) => (
        <div key={line.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <strong className="text-sm text-slate-700">Fuel split {index + 1}</strong>
            <button
              type="button"
              className={BTN_TEXT}
              disabled={lines.length === 1}
              aria-label={`Remove fuel split ${index + 1}`}
              onClick={() => onChange(lines.filter((l) => l.id !== line.id))}
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className={LABEL}>
              Fuel product
              <select className={INPUT} required value={line.fuel} onChange={(e) => update(line.id, { fuel: e.target.value })}>
                <option value="">Select a product</option>
                {fuels.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Stated quantity
              <input
                className={INPUT}
                type="text"
                inputMode="decimal"
                value={line.quantity}
                placeholder="e.g. 23,350"
                onChange={(e) => update(line.id, { quantity: e.target.value })}
              />
            </label>
            <label className={LABEL}>
              Stated unit
              <select className={INPUT} value={line.unit} onChange={(e) => update(line.id, { unit: e.target.value as Unit })}>
                {["L", "gal", "unknown"].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
          {line.fuel === "Other" && (
            <label className={LABEL}>
              Exact Other product
              <input
                className={INPUT}
                maxLength={70}
                value={line.custom}
                placeholder="e.g. Ethanol"
                onChange={(e) => update(line.id, { custom: e.target.value })}
              />
            </label>
          )}
        </div>
      ))}
      <div className="text-sm font-medium text-slate-700" aria-live="polite">
        {totalText}
      </div>
      <p className="text-xs text-slate-500">{previousNote}</p>
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer">Current saved volumes ({baseline.length} lines)</summary>
        <p className="mt-2">
          {baseline.map((row) => (
            <span key={row.id} className="block">
              {row.fuels?.join(" / ") || "Unknown product"}: {row.quantity === null ? "Unknown" : num(row.quantity)} {row.unit} /{" "}
              {row.period} · {row.status}
            </span>
          ))}
        </p>
      </details>
    </section>
  );
}
