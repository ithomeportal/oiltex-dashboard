import type { OilTicket } from "@/lib/ticket-types";
import { STICKY_HEAD, TABLE, TABLE_SCROLL, TR } from "@/components/ui/styles";
import { StateBlock } from "@/components/ui/Controls";
import { TicketCells, TicketHeadCells, sortTicketsByDate } from "./ticketCells";

interface AllTicketsTableProps {
  tickets: ReadonlyArray<OilTicket>;
  loading: boolean;
  sortAsc: boolean;
  emptyLabel: string;
}

/** Flat, date-sorted list of every ticket in the period (with Well / Lease column). */
export function AllTicketsTable({ tickets, loading, sortAsc, emptyLabel }: AllTicketsTableProps) {
  if (loading) return <StateBlock kind="loading">Loading tickets...</StateBlock>;
  if (tickets.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-slate-400">{emptyLabel}</p>;
  }
  return (
    <div className={TABLE_SCROLL}>
      <table className={TABLE}>
        <thead className={STICKY_HEAD}>
          <TicketHeadCells withWell />
        </thead>
        <tbody>
          {sortTicketsByDate(tickets, sortAsc).map((ticket) => (
            <tr key={ticket.id} className={TR}>
              <TicketCells ticket={ticket} withWell />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
