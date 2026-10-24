"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Panel } from "@/components/ui/Panel";
import { Field } from "@/components/ui/Controls";
import {
  TABLE_SCROLL,
  TABLE,
  STICKY_HEAD,
  TH,
  TH_NUM,
  TD,
  TD_NUM,
  TR,
  INPUT,
  BTN_SECONDARY,
  BTN_SUCCESS,
  CARD,
  BTN_SM_PRIMARY,
} from "@/components/ui/styles";
import { fmtNum } from "@/lib/format";
import type { OilTicketUpload, OilTicket } from "@/lib/ticket-types";

export default function UploadPage() {
  const [uploads, setUploads] = useState<OilTicketUpload[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<OilTicket | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch("/api/ops-inventory/uploads");
      const data = await res.json();
      if (data.success) setUploads(data.data);
    } catch (err) {
      console.error("Error fetching uploads:", err);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Poll for status updates when there are pending/processing uploads
  useEffect(() => {
    const hasPending = uploads.some((u) => u.status === "pending" || u.status === "processing");
    if (hasPending) {
      pollingRef.current = setInterval(fetchUploads, 3000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [uploads, fetchUploads]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      let uploadedCount = 0;
      const errors: string[] = [];

      for (const file of Array.from(files)) {
        if (file.type !== "application/pdf") {
          errors.push(`${file.name} is not a PDF file`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch("/api/ops-inventory/upload-file", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
          errors.push(`${file.name}: ${uploadData.error || "Upload failed"}`);
          continue;
        }

        uploadedCount++;
      }

      if (errors.length > 0) {
        setError(errors.join("; "));
      }
      if (uploadedCount > 0) {
        setSuccess(`${uploadedCount} file(s) uploaded successfully`);
      }
      await fetchUploads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProcess = async (uploadId: number) => {
    setProcessing(uploadId);
    setError(null);

    try {
      const res = await fetch("/api/ops-inventory/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: uploadId }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess("Ticket extracted successfully");
        setSelectedTicket(data.data.ticket);
        await fetchUploads();
      } else {
        setError(data.error || "Processing failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessing(null);
    }
  };

  const handleSaveCorrections = async () => {
    if (!selectedTicket) return;

    try {
      const res = await fetch(`/api/ops-inventory/tickets/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFields),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess("Corrections saved");
        setSelectedTicket(data.data);
        setEditFields({});
      } else {
        setError(data.error || "Failed to save corrections");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleEditField = (field: string, value: string) => {
    setEditFields((prev) => ({ ...prev, [field]: value }));
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
        {status}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <Page title="Upload Tickets" subtitle="Upload oil transport ticket PDFs for data extraction">
        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {/* Left: upload zone + extraction review */}
          <div className="space-y-5 min-w-0">
            <div className={`${CARD} p-4`}>
              <div
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("border-blue-400", "bg-blue-50");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("border-blue-400", "bg-blue-50");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-blue-400", "bg-blue-50");
                  handleFileUpload(e.dataTransfer.files);
                }}
              >
                <svg className="w-12 h-12 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-slate-700 font-medium mb-1">
                  {uploading ? "Uploading..." : "Drop PDF tickets here or click to browse"}
                </p>
                <p className="text-sm text-slate-500">
                  PDF files only, up to 10MB each, 10 files per batch
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  disabled={uploading}
                />
              </div>
            </div>

            {/* Extraction Review Panel */}
            {selectedTicket && (
              <Panel
                title={`Extracted Data - Ticket #${selectedTicket.ticket_number}`}
                subtitle="Edited fields are highlighted until saved"
                actions={
                  <>
                    <button
                      onClick={handleSaveCorrections}
                      disabled={Object.keys(editFields).length === 0}
                      className={BTN_SUCCESS}
                    >
                      Save Corrections
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTicket(null);
                        setEditFields({});
                      }}
                      className={BTN_SECONDARY}
                    >
                      Close
                    </button>
                  </>
                }
              >
                <div className="grid grid-cols-2 md:grid-cols-3 2xl:grid-cols-4 gap-x-4 gap-y-3">
                  {reviewFields.map(({ key, label }) => {
                    const currentValue = editFields[key] ?? String(selectedTicket[key as keyof OilTicket] ?? "");
                    const edited = editFields[key] !== undefined;
                    return (
                      <Field key={key} label={label} htmlFor={`review-${key}`}>
                        <input
                          id={`review-${key}`}
                          type="text"
                          value={currentValue}
                          onChange={(e) => handleEditField(key, e.target.value)}
                          className={`${INPUT} ${edited ? "border-amber-400! bg-amber-50!" : ""}`}
                        />
                      </Field>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>

          {/* Right: processing queue / upload history */}
          <Panel title="Processing Queue" subtitle={`${uploads.length} upload(s)`} flush>
            <div className={TABLE_SCROLL}>
              <table className={TABLE}>
                <thead className={STICKY_HEAD}>
                  <tr>
                    <th className={TH}>Filename</th>
                    <th className={TH}>Upload Date</th>
                    <th className={TH_NUM}>Size</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.length > 0 ? (
                    uploads.map((upload) => (
                      <tr key={upload.id} className={TR}>
                        <td className={`${TD} text-slate-800 max-w-[360px] truncate`} title={upload.filename}>
                          <a
                            href={upload.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 hover:underline"
                          >
                            {upload.filename}
                          </a>
                        </td>
                        <td className={`${TD} tabular-nums`}>
                          {new Date(upload.upload_date).toLocaleString()}
                        </td>
                        <td className={TD_NUM}>
                          {fmtNum(upload.file_size / 1024, 1)} KB
                        </td>
                        <td className={TD}>{statusBadge(upload.status)}</td>
                        <td className={`${TD} whitespace-normal min-w-[120px]`}>
                          {(upload.status === "pending" || upload.status === "failed") && (
                            <button
                              onClick={() => handleProcess(upload.id)}
                              disabled={processing === upload.id}
                              className={BTN_SM_PRIMARY}
                            >
                              {processing === upload.id ? "Processing..." : "Extract"}
                            </button>
                          )}
                          {upload.status === "processing" && (
                            <span className="text-sm text-blue-600 animate-pulse">Extracting...</span>
                          )}
                          {upload.error_message && (
                            <p className="text-xs text-red-600 mt-1 max-w-[280px]">{upload.error_message}</p>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        No uploads yet. Drop PDFs to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </Page>
    </DashboardLayout>
  );
}

const reviewFields = [
  { key: "ticket_number", label: "Ticket #" },
  { key: "bol_number", label: "BOL #" },
  { key: "ticket_date", label: "Date" },
  { key: "trucking_company", label: "Trucking Company" },
  { key: "shipper_name", label: "Shipper / Well" },
  { key: "operator", label: "Operator" },
  { key: "receiver_name", label: "Receiver" },
  { key: "driver_name", label: "Driver" },
  { key: "truck_number", label: "Truck #" },
  { key: "loaded_barrels", label: "Loaded BBLs" },
  { key: "net_barrels", label: "Net BBLs" },
  { key: "delivered_bbls", label: "Delivered BBLs" },
  { key: "obs_gravity", label: "Gravity" },
  { key: "obs_temp", label: "Obs Temp" },
  { key: "bsw_percent", label: "BS&W %" },
  { key: "corrected_gravity", label: "Corrected Gravity" },
  { key: "shipper_county", label: "County" },
  { key: "shipper_state", label: "State" },
  { key: "seal_off", label: "Seal Off" },
  { key: "seal_on", label: "Seal On" },
  { key: "meter_factor", label: "Meter Factor" },
  { key: "po_number", label: "PO #" },
];
