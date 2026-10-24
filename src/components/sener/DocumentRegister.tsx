"use client";

import { useMemo, useState } from "react";
import type { SenerDocument } from "@/lib/sener/types";
import { NO_SORT, documentStatusLabel, num, sortRows, toggleSort, type SortColumn } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { BTN_OUTLINE, BTN_PRIMARY, BTN_RED_ORIGINAL, BTN_TEXT, CARD, Icon, SortTh, TD, TH } from "./ui";

interface DocRow {
  doc: SenerDocument;
  linkedCount: number;
  companies: string;
  uploadStatus: string;
  dateAdded: string;
}

const COLUMNS: Record<string, SortColumn<DocRow>> = {
  name: { type: "text", value: (r) => r.doc.name },
  status: { type: "text", value: (r) => r.uploadStatus },
  date: { type: "text", value: (r) => r.dateAdded || null },
  company: { type: "text", value: (r) => r.companies || null },
  linked: { type: "number", value: (r) => r.linkedCount },
};

export default function DocumentRegister() {
  const { workspace, intake, openViewer, setModal, beginAttach, pickFiles } = useSener();
  const [sort, setSort] = useState(NO_SORT);
  const onSort = (key: string) => setSort((s) => toggleSort(s, key));

  const rows = useMemo(() => {
    const base: DocRow[] = workspace.documents.map((doc) => {
      const linked = workspace.records.filter((r) => r.sourceId === doc.id);
      const sources = linked.length ? linked : doc.proposedRecords || [];
      return {
        doc,
        linkedCount: linked.length,
        companies: [...new Set(sources.map((r) => r.company).filter(Boolean))].join(" · "),
        uploadStatus: documentStatusLabel(doc, linked.length),
        dateAdded: doc.created?.slice(0, 10) || "",
      };
    });
    return sortRows(base, sort, COLUMNS);
  }, [workspace, sort]);

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Document register</h2>
          <p className="text-sm text-slate-500">
            Uploads are shared immediately as Pending review. Open Review LOI, confirm each volume, then Register to update team balances.
          </p>
        </div>
        <button type="button" className={`${BTN_OUTLINE} inline-flex items-center gap-2`} onClick={pickFiles}>
          <Icon name="upload" />
          Upload document
        </button>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <SortTh label="Document" sortKey="name" sort={sort} onSort={onSort} />
              <SortTh label="Upload / review status" sortKey="status" sort={sort} onSort={onSort} />
              <SortTh label="Date added" sortKey="date" sort={sort} onSort={onSort} />
              <SortTh label="Counterparties" sortKey="company" sort={sort} onSort={onSort} />
              <SortTh label="Linked records" sortKey="linked" sort={sort} onSort={onSort} numeric />
              <th scope="col" className={`${TH} text-left`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length ? (
              rows.map(({ doc, linkedCount, companies, uploadStatus, dateAdded }) => {
                const canReview = doc.reviewStatus && doc.reviewStatus !== "duplicate" && !linkedCount;
                return (
                  <tr key={doc.id}>
                    <td className={TD}>
                      <div className="flex items-start gap-2">
                        <Icon name="file" className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <strong className="text-slate-800 break-all">{doc.name}</strong>
                          <small className="block text-xs text-slate-500">
                            {doc.reviewStatus ? "Shared with everyone · confirmed volumes only count" : uploadStatus}
                          </small>
                          {doc.uploadedBy && <small className="block text-xs text-slate-400">Uploaded by {doc.uploadedBy}</small>}
                        </div>
                      </div>
                    </td>
                    <td className={TD}>
                      <span className="text-xs font-medium text-slate-700">{uploadStatus}</span>
                      {doc.analysisError && <p className="text-xs text-red-700 mt-1">{doc.analysisError}</p>}
                    </td>
                    <td className={TD}>{dateAdded || "Not recorded"}</td>
                    <td className={TD}>{companies || "No linked counterparty"}</td>
                    <td className={`${TD} text-right`}>{num(linkedCount)}</td>
                    <td className={TD}>
                      <div className="flex flex-wrap items-center gap-2">
                        {canReview && (
                          <button type="button" className={`${BTN_PRIMARY} !px-3 !py-1.5 text-xs whitespace-nowrap`} onClick={() => void intake.resume(doc.id)}>
                            {doc.reviewStatus === "upload_failed"
                              ? "Retry / reattach original"
                              : doc.proposedRecords?.length
                                ? "Review LOI"
                                : "Retry / review LOI"}
                          </button>
                        )}
                        <button type="button" className={BTN_RED_ORIGINAL} onClick={() => openViewer({ name: doc.name, hash: doc.hash, docId: doc.id })}>
                          View original
                        </button>
                        <button type="button" className={`${BTN_OUTLINE} !px-3 !py-1.5 text-xs whitespace-nowrap`} onClick={() => setModal({ kind: "source", docId: doc.id })}>
                          View extraction
                        </button>
                        {doc.hash && (
                          <button type="button" className={`${BTN_TEXT} text-xs whitespace-nowrap`} onClick={() => beginAttach(doc)}>
                            Reattach original
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                  Your document register is empty. Upload a letter of intent to extract and review its details.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
