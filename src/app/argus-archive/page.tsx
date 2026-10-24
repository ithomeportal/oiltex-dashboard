"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Page } from "@/components/ui/Page";
import { Panel } from "@/components/ui/Panel";
import { StateBlock } from "@/components/ui/Controls";
import {
  TABLE_SCROLL,
  TABLE,
  STICKY_HEAD,
  TH,
  TH_NUM,
  TD,
  TD_NUM,
  TR,
  BTN_PRIMARY,
  BTN_SM,
  BTN_SM_PRIMARY,
} from "@/components/ui/styles";
import { fmtDayDate } from "@/lib/format";

interface ArgusReport {
  id: number;
  report_date: string;
  report_type: string;
  subject: string | null;
  filename: string;
  file_url: string;
  file_size: number | null;
  fetched_at: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const COLUMN_COUNT = 5;

function formatDate(dateStr: string): string {
  // report_date is a calendar date; drop any time part before formatting.
  return fmtDayDate(dateStr.split("T")[0]);
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArgusArchivePage() {
  const [reports, setReports] = useState<ArgusReport[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReports = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/argus-archive?page=${p}&limit=20`);
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to load reports");
        return;
      }
      setReports(data.data);
      setMeta(data.meta);
    } catch {
      setError("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports(page);
  }, [page, fetchReports]);

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setUploadMsg(null);
      setError(null);

      try {
        const formData = new FormData();
        for (const file of Array.from(files)) {
          formData.append("files", file);
        }

        const res = await fetch("/api/argus-archive/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (!data.success) {
          setError(data.error || "Upload failed");
          return;
        }

        const msgs = data.results.map(
          (r: { filename: string; status: string; reportDate?: string; error?: string }) =>
            `${r.filename}: ${r.status}${r.error ? ` (${r.error})` : ""}`
        );
        setUploadMsg(msgs.join("\n"));

        // Refresh list
        fetchReports(page);
      } catch {
        setError("Upload failed");
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [page, fetchReports]
  );

  const uploadButton = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={BTN_PRIMARY}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        {uploading ? "Uploading..." : "Upload PDF"}
      </button>
    </>
  );

  return (
    <DashboardLayout>
      <Page title="Argus Archive" subtitle="Daily Argus Americas Crude reports" actions={uploadButton}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {uploadMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm whitespace-pre-line">
            {uploadMsg}
          </div>
        )}

        <Panel flush>
          <div className={TABLE_SCROLL}>
            <table className={TABLE}>
              <thead className={STICKY_HEAD}>
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Report Type</th>
                  <th className={TH}>Filename</th>
                  <th className={TH_NUM}>Size</th>
                  <th className={TH_NUM}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={COLUMN_COUNT}>
                      <StateBlock kind="loading">Loading reports...</StateBlock>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMN_COUNT}>
                      <StateBlock kind="empty">No reports found</StateBlock>
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id} className={TR}>
                      <td className={`${TD} font-medium text-slate-800 tabular-nums`}>
                        {formatDate(report.report_date)}
                      </td>
                      <td className={TD}>{report.report_type}</td>
                      <td className={`${TD} max-w-[640px] truncate`} title={report.filename}>
                        {report.filename}
                      </td>
                      <td className={`${TD_NUM} text-slate-500`}>
                        {formatFileSize(report.file_size)}
                      </td>
                      <td className={`${TD} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={report.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={BTN_SM_PRIMARY}
                          >
                            View PDF
                          </a>
                          <a href={report.file_url} download={report.filename} className={BTN_SM}>
                            Download
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-line bg-slate-50">
              <p className="text-sm text-slate-500 tabular-nums">
                Showing {(meta.page - 1) * meta.limit + 1}–
                {Math.min(meta.page * meta.limit, meta.total)} of{" "}
                {meta.total} reports
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={BTN_SM}
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500 tabular-nums">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page === meta.totalPages}
                  className={BTN_SM}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Panel>
      </Page>
    </DashboardLayout>
  );
}
