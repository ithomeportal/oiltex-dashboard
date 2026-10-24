"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { SortState } from "@/lib/sener/ui-helpers";

export const BTN_PRIMARY =
  "bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed";
export const BTN_OUTLINE =
  "bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";
export const BTN_DANGER =
  "bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed";
export const BTN_RED_ORIGINAL =
  "bg-[#D4222E] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 whitespace-nowrap";
export const BTN_TEXT = "text-blue-600 text-sm font-medium hover:underline disabled:opacity-50";
export const CARD = "bg-white rounded-xl shadow-sm border border-slate-200 p-6";
export const INPUT =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";
export const LABEL = "block text-sm font-medium text-slate-700";
export const TH = "px-3 py-3 text-xs font-medium text-slate-500 uppercase";
export const TD = "px-3 py-3 text-sm text-slate-700 align-top";

const ICONS: Record<string, string> = {
  reset: "M3 11a9 9 0 1 1 2.7 6.4M3 4v7h7",
  download: "M12 3v12M7 10l5 5 5-5M4 16v4h16v-4",
  upload: "M12 16V3M7 8l5-5 5 5M4 15v5h16v-5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7h.01",
  plus: "M12 5v14M5 12h14",
  search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM16 16l5 5",
  refinery: "M3 21V10l6 3V8l6 4V4h4v17M7 17h1M12 17h1M17 17h1M2 21h20",
  truck: "M2 4h12v13H2zM14 9h4l4 5v3h-8M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  fuel: "M4 21V4h9v17M4 10h9M2 21h13M13 12h3v5a2 2 0 0 0 4 0V8l-3-4M17 4v4h3",
  alert: "m12 3 10 18H2zM12 9v5M12 17h.01",
  edit: "m16 3 5 5-12 12-6 1 1-6zM13 6l5 5",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L20 5",
  file: "M14 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8zM14 2v6h6M8 13h8M8 17h5",
  spark: "m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3z",
  layers: "m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
};

export function Icon({ name, className = "w-4 h-4" }: { name: keyof typeof ICONS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[name] ?? ICONS.file} />
    </svg>
  );
}

export function Spinner() {
  return <span className="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />;
}

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  layer?: "base" | "top";
}

// Only the top-most open dialog reacts to Escape.
const escapeStack: symbol[] = [];

/** Dialog shell. `layer="top"` stacks above the base dialog (original viewer). */
export function Modal({ title, subtitle, onClose, children, footer, wide, layer = "base" }: ModalProps) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const token = Symbol("modal");
    escapeStack.push(token);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escapeStack[escapeStack.length - 1] === token) closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = escapeStack.indexOf(token);
      if (i >= 0) escapeStack.splice(i, 1);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 ${layer === "top" ? "z-[60]" : "z-50"} bg-slate-900/40 flex items-start justify-center overflow-y-auto p-4`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? "max-w-5xl" : "max-w-2xl"} my-8`}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-800 break-words">{title}</h2>
            {subtitle && <p className="text-slate-500 text-sm mt-1">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-slate-400 hover:text-slate-700 p-1">
            <Icon name="close" className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Notice({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "amber" | "red" }) {
  const cls = {
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    red: "bg-red-50 border-red-200 text-red-800",
  }[tone];
  return <div className={`border rounded-lg px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function RefBox({ children }: { children: ReactNode }) {
  return <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs text-slate-600">{children}</div>;
}

interface SortThProps {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  numeric?: boolean;
}

/** Accessible sortable header: ↕ / ↑ / ↓ with aria-sort. */
export function SortTh({ label, sortKey, sort, onSort, numeric }: SortThProps) {
  const active = sort.key === sortKey;
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" aria-sort={ariaSort} className={`${TH} ${numeric ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={active ? `${label}: ${ariaSort}. Click to reverse.` : `Sort by ${label}`}
        aria-label={`Sort ${label} ${active && sort.direction === "asc" ? "descending" : "ascending"}`}
        className={`inline-flex items-center gap-1 uppercase hover:text-slate-800 ${active ? "text-slate-800" : ""}`}
      >
        <span>{label}</span>
        <span aria-hidden="true">{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}
