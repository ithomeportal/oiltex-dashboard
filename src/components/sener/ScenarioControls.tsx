"use client";

import { ROLES } from "@/lib/sener/types";
import { STAGE_LABEL, num } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { BTN_OUTLINE, BTN_PRIMARY, CARD, Icon } from "./ui";

function ResetButton({ primary }: { primary?: boolean }) {
  const { resetCalculator } = useSener();
  return (
    <button
      type="button"
      onClick={resetCalculator}
      aria-describedby="calculator-reset-note"
      className={`${primary ? BTN_PRIMARY : BTN_OUTLINE} inline-flex items-center gap-2`}
    >
      <Icon name="reset" />
      Reset calculator
    </button>
  );
}

export default function ScenarioControls() {
  const { base, factors, setFactor, period } = useSener();

  const onValue = (role: (typeof ROLES)[number], raw: string) => {
    const pct = Math.min(300, Math.max(0, Number(raw) || 0));
    setFactor(role, pct / 100);
  };

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h2 className="text-lg font-semibold text-slate-800">Adjust the three stages</h2>
        <ResetButton />
      </div>
      <div className="space-y-6">
        {ROLES.map((role) => {
          const pct = Math.round(factors[role] * 100);
          const liters = (base?.totals[role] ?? 0) * factors[role];
          const gallons = (base?.gallons[role] ?? 0) * factors[role];
          return (
            <div key={role}>
              <div className="flex items-center justify-between mb-2">
                <strong className="text-sm text-slate-800">
                  {STAGE_LABEL[role]} {role === "customer" ? "volume" : "capacity"}
                </strong>
                <label className="inline-flex items-center gap-1 text-sm text-slate-600">
                  <input
                    type="number"
                    min={0}
                    max={300}
                    step={1}
                    value={pct}
                    onChange={(e) => onValue(role, e.target.value)}
                    aria-label={`${STAGE_LABEL[role]} percentage`}
                    className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-right"
                  />
                  %
                </label>
              </div>
              <input
                type="range"
                min={0}
                max={300}
                value={pct}
                onChange={(e) => onValue(role, e.target.value)}
                aria-label={`${STAGE_LABEL[role]} scenario slider`}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>0%</span>
                <span>Documented 100%</span>
                <span>300%</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {num(liters)} L
                <span className="block text-xs font-normal text-slate-500">
                  {num(gallons)} US gal / {period.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100">
        <p id="calculator-reset-note" className="text-xs text-slate-500 max-w-md">
          Reset all three sliders to 100% of documented volumes. Your letters, records and selected calculation period stay unchanged.
        </p>
        <ResetButton primary />
      </div>
    </section>
  );
}
