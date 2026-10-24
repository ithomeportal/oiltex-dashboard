import type { OilTicket } from "@/lib/ticket-types";
import { DASH } from "@/lib/format";
import { STICKY_HEAD, TABLE, TABLE_SCROLL, TD, TD_NUM, TH, TH_NUM } from "@/components/ui/styles";
import { TicketCells, TicketHeadCells, sortTicketsByDate, tint } from "./ticketCells";

export interface WellSummary {
  shipper_name: string;
  operator: string | null;
  county: string | null;
  state: string | null;
  ticket_count: number;
  loaded_bbls: number;
  net_bbls: number;
  delivered_bbls: number;
}

interface WellBreakdownTableProps {
  wells: ReadonlyArray<WellSummary>;
  expandedWells: ReadonlySet<string>;
  loadingWells: ReadonlySet<string>;
  ticketsByWell: Readonly<Record<string, ReadonlyArray<OilTicket>>>;
  sortAsc: boolean;
  emptyLabel: string;
  formatBbls: (val: number | null | undefined) => string;
  onToggle: (shipperName: string) => void;
}

export function WellBreakdownTable({
  wells,
  expandedWells,
  loadingWells,
  ticketsByWell,
  sortAsc,
  emptyLabel,
  formatBbls,
  onToggle,
}: WellBreakdownTableProps) {
  return (
    <div className={TABLE_SCROLL}>
      <table className={TABLE}>
        <thead className={STICKY_HEAD}>
          <tr>
            <th className={`${TH} w-8`} aria-label="Expand" />
            <th className={TH}>Well / Lease</th>
            <th className={TH}>Operator</th>
            <th className={TH}>County</th>
            <th className={TH}>State</th>
            <th className={TH_NUM}>Tickets</th>
            <th className={TH_NUM}>Loaded BBLs</th>
            <th className={TH_NUM}>Net BBLs</th>
            <th className={TH_NUM}>Delivered BBLs</th>
          </tr>
        </thead>
        <tbody>
          {wells.length > 0 ? (
            wells.map((well, i) => {
              const isExpanded = expandedWells.has(well.shipper_name);
              return (
                <WellRow
                  key={i}
                  well={well}
                  index={i}
                  isExpanded={isExpanded}
                  isLoading={isExpanded && loadingWells.has(well.shipper_name)}
                  tickets={isExpanded ? (ticketsByWell[well.shipper_name] ?? []) : []}
                  sortAsc={sortAsc}
                  formatBbls={formatBbls}
                  onClick={() => onToggle(well.shipper_name)}
                />
              );
            })
          ) : (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface WellRowProps {
  well: WellSummary;
  index: number;
  isExpanded: boolean;
  isLoading: boolean;
  tickets: ReadonlyArray<OilTicket>;
  sortAsc: boolean;
  formatBbls: (val: number | null | undefined) => string;
  onClick: () => void;
}

function WellRow({ well, index, isExpanded, isLoading, tickets, sortAsc, formatBbls, onClick }: WellRowProps) {
  const sortedTickets = sortTicketsByDate(tickets, sortAsc);
  const rowBg = isExpanded ? "bg-blue-50" : index % 2 === 0 ? "bg-white" : "bg-slate-50/60";
  return (
    <>
      <tr
        className={`cursor-pointer transition-colors hover:bg-blue-50/70 ${rowBg}`}
        onClick={onClick}
        aria-expanded={isExpanded}
      >
        <td className={tint(TD, "text-slate-400")}>
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </td>
        <td className={tint(TD, "font-medium text-slate-800")}>{well.shipper_name}</td>
        <td className={tint(TD, "text-slate-600")}>{well.operator ?? DASH}</td>
        <td className={tint(TD, "text-slate-600")}>{well.county ?? DASH}</td>
        <td className={tint(TD, "text-slate-600")}>{well.state ?? DASH}</td>
        <td className={tint(TD_NUM, "text-slate-800")}>{well.ticket_count}</td>
        <td className={tint(TD_NUM, "text-slate-800")}>{formatBbls(well.loaded_bbls)}</td>
        <td className={tint(TD_NUM, "text-slate-800")}>{formatBbls(well.net_bbls)}</td>
        <td className={tint(TD_NUM, "font-medium text-blue-600")}>{formatBbls(well.delivered_bbls)}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} className="p-0 border-b border-blue-100">
            <div className="bg-blue-50/40 pl-10 pr-4 py-3">
              {isLoading ? (
                <p className="text-sm text-slate-400 text-center py-3 animate-pulse">Loading tickets...</p>
              ) : sortedTickets.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-blue-100 bg-white">
                  <table className={TABLE}>
                    <thead>
                      <TicketHeadCells withWell={false} nested />
                    </thead>
                    <tbody>
                      {sortedTickets.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-blue-50/60 transition-colors">
                          <TicketCells ticket={ticket} withWell={false} stopPropagation />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-3">No tickets found</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
