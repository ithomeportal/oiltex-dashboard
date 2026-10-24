"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { BarSeriesChart } from "@/components/charts/BarSeriesChart";
import { SERIES } from "@/components/charts/theme";
import { StateBlock } from "@/components/ui/Controls";
import { Panel } from "@/components/ui/Panel";
import { SELECT } from "@/components/ui/styles";
import type { WellBreakdown } from "./types";

interface LaneRow {
  /** Full display label (shown in tooltip); axis tick is shortened. */
  lane: string;
  shipper_name: string;
  delivered_bbls: number;
}

const ROW_HEIGHT = 44;
/** Shipper name is cut on the axis (as before the redesign); the tooltip keeps the full name. */
const MAX_NAME_CHARS = 26;

function fmtBblsWhole(v: number): string {
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} bbl`;
}

function shortenName(name: string): string {
  return name.length > MAX_NAME_CHARS ? `${name.slice(0, MAX_NAME_CHARS - 1)}…` : name;
}

/** Same URL the dashboard has always linked to: shipper filter + whole lane month. */
function buildTicketUrl(shipperName: string, laneMonth: string): string {
  const [y2, m2] = laneMonth.split("-");
  const lastDay = new Date(parseInt(y2), parseInt(m2), 0).getDate();
  return `/ops-inventory/tickets?shipper=${encodeURIComponent(shipperName)}&dateFrom=${laneMonth}-01&dateTo=${laneMonth}-${String(lastDay).padStart(2, "0")}`;
}

interface LaneVolumePanelProps {
  lanes: WellBreakdown[];
  laneMonth: string;
  onLaneMonthChange: (month: string) => void;
  monthOptions: ReadonlyArray<{ value: string; label: string }>;
}

export function LaneVolumePanel({ lanes, laneMonth, onLaneMonthChange, monthOptions }: LaneVolumePanelProps) {
  const router = useRouter();
  const rows = useMemo<LaneRow[]>(
    () =>
      lanes.map((l) => ({
        lane: `${shortenName(l.shipper_name)} · ${l.ticket_count} tix`,
        shipper_name: l.shipper_name,
        delivered_bbls: l.delivered_bbls,
      })),
    [lanes],
  );
  const totalTickets = lanes.reduce((s, l) => s + l.ticket_count, 0);
  const totalBbls = lanes.reduce((s, l) => s + l.delivered_bbls, 0);

  return (
    <Panel
      title="Delivery Volume by Lane"
      subtitle={
        <span className="tabular-nums">
          {totalTickets} tickets · {totalBbls.toLocaleString(undefined, { maximumFractionDigits: 0 })} bbls · click a bar to open its tickets
        </span>
      }
      actions={
        <select
          aria-label="Lane month"
          value={laneMonth}
          onChange={(e) => onLaneMonthChange(e.target.value)}
          className={`${SELECT} w-44 cursor-pointer`}
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      }
    >
      {rows.length > 0 ? (
        <BarSeriesChart
          data={rows}
          categoryKey="lane"
          bars={[{ key: "delivered_bbls", label: "Delivered", color: SERIES.blue }]}
          layout="vertical"
          height={Math.max(160, rows.length * ROW_HEIGHT + 40)}
          categoryWidth={220}
          valueFormatter={fmtBblsWhole}
          showValues
          onBarClick={(row) => router.push(buildTicketUrl(row.shipper_name, laneMonth))}
        />
      ) : (
        <StateBlock kind="empty" height="h-40">No tickets for this month</StateBlock>
      )}
    </Panel>
  );
}
