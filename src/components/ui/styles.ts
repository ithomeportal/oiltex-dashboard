// Shared class strings. One source of truth for tables, inputs and buttons so
// every page looks the same. Spec: docs/SPEC-UI-DESIGN-SYSTEM.md

// ---- tables ----------------------------------------------------------------
/** Scroll pane for a table; pair with STICKY_HEAD on <thead>. */
export const TABLE_SCROLL = "relative overflow-auto max-h-[70vh]";
export const TABLE = "w-full text-sm border-separate border-spacing-0";
export const STICKY_HEAD = "sticky top-0 z-10";
export const TH =
  "bg-slate-50 border-b border-line px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap";
export const TH_NUM = `${TH} text-right`;
export const TD = "border-b border-slate-100 px-3 py-2 text-slate-700 whitespace-nowrap";
export const TD_NUM = `${TD} text-right tabular-nums`;
export const TR = "even:bg-slate-50/60 hover:bg-blue-50/50 transition-colors";
export const TFOOT_TD = "sticky bottom-0 bg-slate-100 border-t border-line px-3 py-2 font-semibold text-slate-800 whitespace-nowrap";

// ---- form controls ---------------------------------------------------------
export const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1";
export const INPUT =
  "w-full h-9 px-3 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500";
export const SELECT = `${INPUT} pr-8`;

// ---- buttons ---------------------------------------------------------------
const BTN_BASE =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
export const BTN_PRIMARY = `${BTN_BASE} bg-blue-600 text-white hover:bg-blue-700`;
export const BTN_SECONDARY = `${BTN_BASE} bg-white text-slate-700 border border-slate-300 hover:bg-slate-50`;
export const BTN_SUCCESS = `${BTN_BASE} bg-emerald-600 text-white hover:bg-emerald-700`;
export const BTN_DANGER = `${BTN_BASE} bg-red-600 text-white hover:bg-red-700`;
export const BTN_SM =
  "inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";
export const BTN_SM_PRIMARY =
  "inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

// ---- surfaces --------------------------------------------------------------
export const CARD = "bg-white rounded-xl border border-line shadow-sm";

// ---- grids -----------------------------------------------------------------
/** KPI rows: 2 → 3 → 5 across. */
export const KPI_GRID_5 = "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3";
export const KPI_GRID_4 = "grid grid-cols-2 xl:grid-cols-4 gap-3";
/** Charts / panels side by side from xl. */
export const GRID_2 = "grid grid-cols-1 xl:grid-cols-2 gap-4";
