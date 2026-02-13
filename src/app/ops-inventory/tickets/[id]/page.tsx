"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import type { OilTicket } from "@/lib/ticket-types";

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
        <div className="p-8 flex justify-center items-center min-h-[400px]">
          <p className="text-slate-400">Loading ticket...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !ticket) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <p className="text-red-700">{error || "Ticket not found"}</p>
              <button
                onClick={() => router.push("/ops-inventory/tickets")}
                className="mt-4 text-sm text-blue-600 hover:underline"
              >
                Back to Tickets
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <Link
                href="/ops-inventory/tickets"
                className="text-sm text-blue-600 hover:underline mb-2 inline-block"
              >
                &larr; Back to Tickets
              </Link>
              <h1 className="text-2xl font-bold text-slate-800">
                Ticket #{ticket.ticket_number}
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {ticket.shipper_name} &rarr; {ticket.receiver_name} &middot; {formatDate(ticket.ticket_date)}
              </p>
            </div>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving || Object.keys(editFields).length === 0}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditFields({});
                    }}
                    className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600"
                >
                  Edit Ticket
                </button>
              )}
            </div>
          </div>

          {/* Highlight Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <HighlightCard label="Loaded BBLs" value={formatNum(ticket.loaded_barrels, 2)} color="amber" />
            <HighlightCard label="Net BBLs" value={formatNum(ticket.net_barrels, 2)} color="green" />
            <HighlightCard label="Delivered BBLs" value={formatNum(ticket.delivered_bbls, 2)} color="blue" />
            <HighlightCard label="Gravity / BS&W" value={`${formatNum(ticket.obs_gravity, 1)} / ${formatNum(ticket.bsw_percent, 2)}%`} color="purple" />
          </div>

          {/* Field Sections */}
          {fieldSections.map((section) => (
            <div key={section.title} className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-800">{section.title}</h2>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {section.fields.map(({ key, label, format }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                    {editing && key !== "manually_corrected" && key !== "extraction_confidence" ? (
                      <input
                        type="text"
                        defaultValue={ticket[key as keyof OilTicket]?.toString() ?? ""}
                        onChange={(e) =>
                          setEditFields((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          editFields[key] !== undefined
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-300"
                        }`}
                      />
                    ) : (
                      <p className="text-sm text-slate-800 font-medium">
                        {getDisplayValue(key, format)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

function HighlightCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    amber: "border-amber-200 bg-amber-50",
    green: "border-green-200 bg-green-50",
    blue: "border-blue-200 bg-blue-50",
    purple: "border-purple-200 bg-purple-50",
  };
  const textColors: Record<string, string> = {
    amber: "text-amber-700",
    green: "text-green-700",
    blue: "text-blue-700",
    purple: "text-purple-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? ""}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${textColors[color] ?? ""}`}>{value}</p>
    </div>
  );
}
