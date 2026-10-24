import type { ReactNode } from "react";

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}

/** Pill-group toggle for small option sets (ranges, tabs, months). */
export function Segmented<T extends string>({ options, value, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex flex-wrap rounded-lg border border-line bg-slate-100 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`h-8 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/** Labelled control for toolbars and filter forms. */
export function Field({ label, htmlFor, className = "", children }: FieldProps) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

type StateKind = "loading" | "empty" | "error";

const STATE_TEXT: Record<StateKind, string> = {
  loading: "text-slate-400",
  empty: "text-slate-500",
  error: "text-red-600",
};

/** Fixed-height placeholder so a dead feed never looks like a quiet day. */
export function StateBlock({ kind, children, height = "h-48" }: { kind: StateKind; children: ReactNode; height?: string }) {
  return (
    <div className={`${height} flex flex-col items-center justify-center gap-2 text-sm ${STATE_TEXT[kind]}`}>
      {kind === "loading" && (
        <span className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" aria-hidden />
      )}
      <span>{children}</span>
    </div>
  );
}
