import type { ReactNode } from "react";
import { CARD } from "./styles";

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Controls on the right of the header (segmented control, export, legend). */
  actions?: ReactNode;
  /** No body padding — for tables that run edge to edge. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, actions, flush = false, className = "", children }: PanelProps) {
  const hasHeader = title || subtitle || actions;
  return (
    <section className={`${CARD} min-w-0 overflow-hidden ${className}`}>
      {hasHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}
