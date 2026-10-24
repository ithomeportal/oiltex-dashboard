import { Panel } from "@/components/ui/Panel";
import { StateBlock } from "@/components/ui/Controls";
import { BTN_SM, STICKY_HEAD, TABLE, TABLE_SCROLL, TD, TD_NUM, TH, TH_NUM, TR } from "@/components/ui/styles";
import { DASH, fmtDayDate } from "@/lib/format";
import { formatDiff, formatDollar, netAfterLease, type ArgusPricingRow, type PricingApiResponse } from "../_lib";

interface DailyTableProps {
  rows: readonly ArgusPricingRow[] | undefined;
  loading: boolean;
  selectedMonth: string;
  isWtlLease: boolean;
  transport: number;
  meta: PricingApiResponse["meta"] | null;
  page: number;
  onPrev: () => void;
  onNext: () => void;
}

const COLUMNS: readonly { label: string; numeric: boolean }[] = [
  { label: "Date", numeric: false },
  { label: "NYMEX CMA", numeric: true },
  { label: "CMA Diff Daily", numeric: true },
  { label: "CMA Diff MTD", numeric: true },
  { label: "Midland Daily", numeric: true },
  { label: "Midland MTD", numeric: true },
  { label: "WTL Midland", numeric: true },
  { label: "Est Net Daily", numeric: true },
  { label: "Est Net MTD", numeric: true },
  { label: "Conf", numeric: true },
];

function DailyRow({ row, isWtlLease, transport }: { row: ArgusPricingRow; isWtlLease: boolean; transport: number }) {
  const rowEstNetDaily = netAfterLease(row, row.est_net_daily, isWtlLease, transport);
  const rowEstNetMtd = netAfterLease(row, row.est_net_mtd, isWtlLease, transport);
  return (
    <tr className={TR}>
      <td className={`${TD} font-medium text-slate-900`}>{fmtDayDate(row.report_date)}</td>
      <td className={`${TD_NUM} text-amber-700`}>{formatDollar(row.nymex_cma_td)}</td>
      <td className={TD_NUM}>{formatDiff(row.cma_diff_daily)}</td>
      <td className={TD_NUM}>{formatDiff(row.cma_diff_mtd)}</td>
      <td className={TD_NUM}>{formatDiff(row.midland_diff_daily)}</td>
      <td className={`${TD_NUM} text-emerald-700`}>{formatDiff(row.midland_diff_mtd)}</td>
      <td className={`${TD_NUM} font-medium text-emerald-700`}>{formatDollar(row.wtl_midland_wtd_avg)}</td>
      <td className={TD_NUM}>{formatDollar(rowEstNetDaily)}</td>
      <td className={`${TD_NUM} font-medium text-blue-700`}>{formatDollar(rowEstNetMtd)}</td>
      <td className={`${TD_NUM} text-slate-500`}>{row.extraction_confidence ?? DASH}</td>
    </tr>
  );
}

export function DailyTable({ rows, loading, selectedMonth, isWtlLease, transport, meta, page, onPrev, onNext }: DailyTableProps) {
  const empty = !rows || rows.length === 0;
  return (
    <Panel flush title="Daily Pricing" subtitle="Differentials 4dp · prices $/bbl">
      <div className={TABLE_SCROLL}>
        <table className={TABLE}>
          <thead className={STICKY_HEAD}>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.label} className={c.numeric ? TH_NUM : TH}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length}>
                  <StateBlock kind="loading">Loading...</StateBlock>
                </td>
              </tr>
            ) : empty ? (
              <tr>
                <td colSpan={COLUMNS.length}>
                  <StateBlock kind="empty">
                    No pricing data for {selectedMonth}. Run backfill extraction to populate.
                  </StateBlock>
                </td>
              </tr>
            ) : (
              rows.map((row) => <DailyRow key={row.id} row={row} isWtlLease={isWtlLease} transport={transport} />)
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-line">
          <p className="text-sm text-slate-500 tabular-nums">
            Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onPrev} disabled={page === 1} className={BTN_SM}>
              Previous
            </button>
            <span className="text-sm text-slate-500 tabular-nums">
              Page {meta.page} of {meta.totalPages}
            </span>
            <button type="button" onClick={onNext} disabled={page === meta.totalPages} className={BTN_SM}>
              Next
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
