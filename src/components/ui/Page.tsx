import type { ReactNode } from "react";

interface PageProps {
  title: string;
  subtitle?: ReactNode;
  /** Right side of the title bar: primary actions / downloads. */
  actions?: ReactNode;
  /** Optional filter strip, sticks to the top while scrolling. */
  toolbar?: ReactNode;
  children: ReactNode;
}

/** Standard page frame: title bar → sticky toolbar → full-width body (max 1920px). */
export function Page({ title, subtitle, actions, toolbar, children }: PageProps) {
  return (
    <div className="min-w-0">
      <header className="bg-white border-b border-line">
        <div className="mx-auto w-full max-w-[1920px] px-4 lg:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>
      {toolbar && (
        <div className="sticky top-14 lg:top-0 z-20 bg-white/95 backdrop-blur border-b border-line shadow-sm">
          <div className="mx-auto w-full max-w-[1920px] px-4 lg:px-6 py-2.5 flex flex-wrap items-end gap-3">
            {toolbar}
          </div>
        </div>
      )}
      <div className="mx-auto w-full max-w-[1920px] px-4 lg:px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}
