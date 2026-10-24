import Link from "next/link";
import type { MouseEvent } from "react";
import type { OilTicket } from "@/lib/ticket-types";
import { DASH, fmtDayDate, fmtNum, toNum } from "@/lib/format";
import { TD, TD_NUM, TH, TH_NUM } from "@/components/ui/styles";

/** Swap the default TD text colour (avoids two competing text-* utilities). */
export function tint(base: string, color: string): string {
  return base.replace("text-slate-700", color);
}

/** BS&W% at or above this is flagged bold red. */
export const BSW_ALERT = 0.9;

export function bswClass(value: unknown): string {
  const n = toNum(value);
  return n !== null && n >= BSW_ALERT ? "font-bold text-red-600" : "text-slate-800";
}

export function sortTicketsByDate(tickets: ReadonlyArray<OilTicket>, asc: boolean): OilTicket[] {
  return [...tickets].sort((a, b) => {
    const dateA = a.ticket_date ? new Date(a.ticket_date).getTime() : 0;
    const dateB = b.ticket_date ? new Date(b.ticket_date).getTime() : 0;
    return asc ? dateA - dateB : dateB - dateA;
  });
}

const PDF_PATHS = (
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
    <path d="M8 12h3v1.5H9.5v1H11V16H8v-1.5h1.5v-1H8V12zm4 0h2c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-2v-4zm1.5 1.5v1h.5v-1h-.5zM16 12h2v1.5h-1v.5h1V16h-2v-1.5h1v-.5h-1V12z" />
  </>
);

export function PdfIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {PDF_PATHS}
    </svg>
  );
}

export function PdfLink({ url, stopPropagation = false }: { url: string | null; stopPropagation?: boolean }) {
  if (!url) return <span className="text-slate-300">{DASH}</span>;
  const onClick = stopPropagation ? (e: MouseEvent) => e.stopPropagation() : undefined;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="View original PDF"
      className="inline-flex items-center justify-center text-red-500 hover:text-red-700 transition-colors"
      onClick={onClick}
    >
      <PdfIcon />
    </a>
  );
}

/** Header cells for a per-ticket table. `withWell` adds the Well / Lease column; `nested` tints for the well sub-table. */
export function TicketHeadCells({ withWell, nested = false }: { withWell: boolean; nested?: boolean }) {
  const th = nested ? TH.replace("bg-slate-50", "bg-blue-50/80") : TH;
  const thNum = nested ? TH_NUM.replace("bg-slate-50", "bg-blue-50/80") : TH_NUM;
  return (
    <tr>
      <th className={th}>Date</th>
      {withWell && <th className={th}>Well / Lease</th>}
      <th className={th}>Ticket #</th>
      <th className={th}>BOL #</th>
      <th className={th}>Driver</th>
      <th className={th}>Receiver</th>
      <th className={thNum}>Loaded</th>
      <th className={thNum}>Net</th>
      <th className={thNum}>Delivered</th>
      <th className={thNum}>BS&amp;W%</th>
      <th className={thNum}>Gravity</th>
      <th className={`${th} text-center`}>PDF</th>
    </tr>
  );
}

/** Body cells for one ticket, matching TicketHeadCells. */
export function TicketCells({ ticket, withWell, stopPropagation = false }: { ticket: OilTicket; withWell: boolean; stopPropagation?: boolean }) {
  return (
    <>
      <td className={TD}>{fmtDayDate(ticket.ticket_date)}</td>
      {withWell && (
        <td className={tint(TD, "font-medium text-slate-800")}>{ticket.shipper_name ?? DASH}</td>
      )}
      <td className={tint(TD, "font-medium text-blue-600")}>
        <Link href={`/ops-inventory/tickets/${ticket.id}`} className="hover:underline">
          {ticket.ticket_number ?? DASH}
        </Link>
      </td>
      <td className={tint(TD, "text-slate-600")}>{ticket.bol_number ?? DASH}</td>
      <td className={tint(TD, "text-slate-600")}>{ticket.driver_name ?? DASH}</td>
      <td className={tint(TD, "text-slate-600")}>{ticket.receiver_name ?? DASH}</td>
      <td className={tint(TD_NUM, "text-slate-800")}>{fmtNum(ticket.loaded_barrels, 2)}</td>
      <td className={tint(TD_NUM, "text-slate-800")}>{fmtNum(ticket.net_barrels, 2)}</td>
      <td className={tint(TD_NUM, "font-medium text-blue-600")}>{fmtNum(ticket.delivered_bbls, 2)}</td>
      <td className={tint(TD_NUM, bswClass(ticket.bsw_percent))}>{fmtNum(ticket.bsw_percent, 2)}</td>
      <td className={tint(TD_NUM, "text-slate-800")}>{fmtNum(ticket.obs_gravity, 1)}</td>
      <td className={`${TD} text-center`}>
        <PdfLink url={ticket.file_url} stopPropagation={stopPropagation} />
      </td>
    </>
  );
}
