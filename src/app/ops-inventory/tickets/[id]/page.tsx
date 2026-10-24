"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Panel } from "@/components/ui/Panel";
import { KpiTile } from "@/components/ui/KpiTile";
import { StateBlock } from "@/components/ui/Controls";
import { BTN_SECONDARY, BTN_SUCCESS, INPUT, KPI_GRID_4, LABEL } from "@/components/ui/styles";
import type { OilTicket } from "@/lib/ticket-types";
import { PdfIcon } from "../../_components/ticketCells";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatNum(val: string | number | null, decimals = 2): string {
  if (val === null || val === undefined) return "--";
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "--";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const fieldSections = [
  {
    title: "Identification",
    fields: [
      { key: "ticket_number", label: "Ticket #" },
      { key: "bol_number", label: "BOL #" },
      { key: "ticket_date", label: "Ticket Date", format: "date" },
      { key: "trucking_company", label: "Trucking Company" },
      { key: "po_number", label: "PO #" },
    ],
  },
  {
    title: "Shipper (Well/Location)",
    fields: [
      { key: "shipper_name", label: "Name / Lease" },
      { key: "operator", label: "Operator" },
      { key: "shipper_account", label: "Account" },
      { key: "shipper_time", label: "Time" },
      { key: "property_number", label: "Property #" },
      { key: "legal_land_desc", label: "Legal Land Desc" },
      { key: "federal_lease_number", label: "Federal Lease #" },
      { key: "shipper_city", label: "City" },
      { key: "shipper_county", label: "County" },
      { key: "shipper_state", label: "State" },
      { key: "shipper_lat", label: "Latitude" },
      { key: "shipper_lon", label: "Longitude" },
    ],
  },
  {
    title: "Receiver (Pipeline/Storage)",
    fields: [
      { key: "receiver_name", label: "Name" },
      { key: "receiver_account", label: "Account" },
      { key: "receiver_time", label: "Time" },
      { key: "receiver_city", label: "City" },
      { key: "receiver_county", label: "County" },
      { key: "receiver_state", label: "State" },
      { key: "receiver_lat", label: "Latitude" },
      { key: "receiver_lon", label: "Longitude" },
    ],
  },
  {
    title: "Oil Measurements",
    fields: [
      { key: "loaded_barrels", label: "Loaded BBLs", format: "num4" },
      { key: "net_barrels", label: "Net BBLs", format: "num4" },
      { key: "delivered_bbls", label: "Delivered BBLs", format: "num4" },
      { key: "obs_gravity", label: "Observed Gravity", format: "num" },
      { key: "corrected_gravity", label: "Corrected Gravity", format: "num" },
      { key: "obs_temp", label: "Observed Temp (F)", format: "num" },
      { key: "start_temp", label: "Start Temp", format: "num" },
      { key: "stop_temp", label: "Stop Temp", format: "num" },
      { key: "bsw_percent", label: "BS&W %", format: "num" },
      { key: "avg_line_temp", label: "Avg Line Temp", format: "num" },
      { key: "meter_factor", label: "Meter Factor", format: "num6" },
    ],
  },
  {
    title: "Tank & Meter",
    fields: [
      { key: "tank_id", label: "Tank ID" },
      { key: "tank_bbls_per_inch", label: "BBLs/Inch", format: "num" },
      { key: "tank_height", label: "Tank Height", format: "num" },
      { key: "tank_volume", label: "Tank Volume", format: "num" },
      { key: "header_number", label: "Header #" },
      { key: "start_meter_1", label: "Start Meter 1", format: "num" },
      { key: "stop_meter_1", label: "Stop Meter 1", format: "num" },
      { key: "start_meter_2", label: "Start Meter 2", format: "num" },
      { key: "stop_meter_2", label: "Stop Meter 2", format: "num" },
    ],
  },
  {
    title: "Seals & Timing",
    fields: [
      { key: "seal_off", label: "Seal Off" },
      { key: "seal_on", label: "Seal On" },
      { key: "time_off", label: "Time Off" },
      { key: "time_on", label: "Time On" },
    ],
  },
  {
    title: "Transport",
    fields: [
      { key: "driver_name", label: "Driver" },
      { key: "truck_number", label: "Truck #" },
      { key: "trailer_number", label: "Trailer #" },
      { key: "standard_distance", label: "Standard Distance (mi)", format: "num" },
      { key: "loaded_miles", label: "Loaded Miles", format: "num" },
      { key: "rerouted_miles", label: "Rerouted Miles", format: "num" },
      { key: "road_restrictions", label: "Road Restrictions" },
    ],
  },
  {
    title: "Notes & Metadata",
    fields: [
      { key: "notes", label: "Notes" },
      { key: "driver_notes", label: "Driver Notes" },
      { key: "extraction_confidence", label: "Extraction Confidence %" },
      { key: "manually_corrected", label: "Manually Corrected" },
    ],
  },
] as ReadonlyArray<{
  title: string;
  fields: ReadonlyArray<{ key: string; label: string; format?: string }>;
}>;

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<OilTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchTicket = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ops-inventory/tickets/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setTicket(data.data);
      } else {
        setError(data.error || "Ticket not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleSave = async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ops-inventory/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFields),
      });
      const data = await res.json();
      if (data.success) {
        setTicket(data.data);
        setEditing(false);
        setEditFields({});
      } else {
        setError(data.error || "Save failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const getDisplayValue = (key: string, format?: string): string => {
    if (!ticket) return "--";
    const raw = ticket[key as keyof OilTicket];
    if (raw === null || raw === undefined) return "--";
    if (format === "date") return formatDate(String(raw));
    if (format === "num") return formatNum(raw as string | number, 2);
    if (format === "num4") return formatNum(raw as string | number, 4);
    if (format === "num6") return formatNum(raw as string | number, 6);
    if (typeof raw === "boolean") return raw ? "Yes" : "No";
    return String(raw);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <StateBlock kind="loading" height="min-h-[400px]">Loading ticket...</StateBlock>
      </DashboardLayout>
    );
  }

  if (error || !ticket) {
    return (
      <DashboardLayout>
        <Page title="Ticket">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700">{error || "Ticket not found"}</p>
            <button
              type="button"
              onClick={() => router.push("/ops-inventory/tickets")}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Back to Tickets
            </button>
          </div>
        </Page>
      </DashboardLayout>
    );
  }

  const subtitle = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Link href="/ops-inventory/tickets" className="text-blue-600 hover:underline">
        &larr; Back to Tickets
      </Link>
      <span>
        {ticket.shipper_name} &rarr; {ticket.receiver_name} &middot; {formatDate(ticket.ticket_date)}
      </span>
      {ticket.file_url && (
        <a
          href={ticket.file_url}
          target="_blank"
          rel="noopener noreferrer"
          title="View original PDF"
          className="inline-flex items-center text-red-500 hover:text-red-700 transition-colors"
        >
          <PdfIcon className="w-5 h-5" />
        </a>
      )}
    </span>
  );

  const actions = editing ? (
    <>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || Object.keys(editFields).length === 0}
        className={BTN_SUCCESS}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setEditFields({});
        }}
        className={BTN_SECONDARY}
      >
        Cancel
      </button>
    </>
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap bg-amber-500 text-white hover:bg-amber-600"
    >
      Edit Ticket
    </button>
  );

  return (
    <DashboardLayout>
      <Page title={`Ticket #${ticket.ticket_number}`} subtitle={subtitle} actions={actions}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {/* Left: ticket data / inline edit form */}
          <div className="space-y-5 min-w-0">
            <div className={KPI_GRID_4}>
              <KpiTile label="Loaded BBLs" value={formatNum(ticket.loaded_barrels, 2)} tone="warn" />
              <KpiTile label="Net BBLs" value={formatNum(ticket.net_barrels, 2)} tone="good" />
              <KpiTile label="Delivered BBLs" value={formatNum(ticket.delivered_bbls, 2)} tone="accent" />
              <KpiTile
                label="Gravity / BS&W"
                value={`${formatNum(ticket.obs_gravity, 1)} / ${formatNum(ticket.bsw_percent, 2)}%`}
              />
            </div>

            {fieldSections.map((section) => (
              <Panel key={section.title} title={section.title}>
                <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-x-4 gap-y-3">
                  {section.fields.map(({ key, label, format }) => {
                    const editable = editing && key !== "manually_corrected" && key !== "extraction_confidence";
                    const inputId = `field-${key}`;
                    return (
                      <div key={key} className="min-w-0">
                        <label htmlFor={editable ? inputId : undefined} className={LABEL}>
                          {label}
                        </label>
                        {editable ? (
                          <input
                            id={inputId}
                            type="text"
                            defaultValue={ticket[key as keyof OilTicket]?.toString() ?? ""}
                            onChange={(e) =>
                              setEditFields((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className={`${INPUT} ${editFields[key] !== undefined ? "!border-amber-400 !bg-amber-50" : ""}`}
                          />
                        ) : (
                          <p className="text-sm text-slate-800 font-medium break-words tabular-nums">
                            {getDisplayValue(key, format)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Panel>
            ))}
          </div>

          {/* Right: original PDF */}
          <Panel
            title="Original Ticket PDF"
            flush
            className="xl:sticky xl:top-4"
            actions={
              ticket.file_url ? (
                <a href={ticket.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  Open in new tab
                </a>
              ) : undefined
            }
          >
            {ticket.file_url ? (
              <iframe
                title={`Ticket ${ticket.ticket_number ?? ""} PDF`}
                src={ticket.file_url}
                className="w-full h-[80vh] border-0 bg-slate-50"
              />
            ) : (
              <StateBlock kind="empty" height="h-[40vh]">No PDF attached to this ticket</StateBlock>
            )}
          </Panel>
        </div>
      </Page>
    </DashboardLayout>
  );
}
