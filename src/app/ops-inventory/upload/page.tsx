"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
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
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>
        {status}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800">Upload Tickets</h1>
            <p className="text-slate-500 text-sm mt-1">
              Upload oil transport ticket PDFs for data extraction
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              {success}
            </div>
          )}

          {/* Upload Zone */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer"
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
              <svg className="w-12 h-12 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-slate-600 font-medium mb-1">
                {uploading ? "Uploading..." : "Drop PDF tickets here or click to browse"}
              </p>
              <p className="text-sm text-slate-400">
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

          {/* Processing Queue */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-8">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Processing Queue</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Filename</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Upload Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Size</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {uploads.length > 0 ? (
                    uploads.map((upload) => (
                      <tr key={upload.id}>
                        <td className="px-4 py-3 text-sm text-slate-800">
                          <a
                            href={upload.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 hover:underline"
                          >
                            {upload.filename}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {new Date(upload.upload_date).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {(upload.file_size / 1024).toFixed(1)} KB
                        </td>
                        <td className="px-4 py-3">{statusBadge(upload.status)}</td>
                        <td className="px-4 py-3">
                          {(upload.status === "pending" || upload.status === "failed") && (
                            <button
                              onClick={() => handleProcess(upload.id)}
                              disabled={processing === upload.id}
                              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                              {processing === upload.id ? "Processing..." : "Extract"}
                            </button>
                          )}
                          {upload.status === "processing" && (
                            <span className="text-sm text-blue-600 animate-pulse">Extracting...</span>
                          )}
                          {upload.error_message && (
                            <p className="text-xs text-red-500 mt-1">{upload.error_message}</p>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                        No uploads yet. Drop PDFs above to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Extraction Review Panel */}
          {selectedTicket && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800">
                  Extracted Data - Ticket #{selectedTicket.ticket_number}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveCorrections}
                    disabled={Object.keys(editFields).length === 0}
                    className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Save Corrections
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTicket(null);
                      setEditFields({});
                    }}
                    className="text-sm bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                {reviewFields.map(({ key, label }) => {
                  const currentValue = editFields[key] ?? String(selectedTicket[key as keyof OilTicket] ?? "");
                  return (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleEditField(key, e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          editFields[key] !== undefined
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-300"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
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
