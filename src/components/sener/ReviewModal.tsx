"use client";

import { useState } from "react";
import type { Role, SenerRecord } from "@/lib/sener/types";
import { ROLE_LABEL, normCompany, num, replaceRows } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { BTN_OUTLINE, BTN_PRIMARY, BTN_TEXT, Modal, Notice } from "./ui";

/** Review extracted volumes (app.js openExtractionReview). */
export default function ReviewModal({ error }: { error?: string }) {
  const { intake, openRecord, openViewer, closeModal, toast } = useSener();
  const [registering, setRegistering] = useState(false);
  const ex = intake.extraction;
  if (!ex) return null;

  const current = () => intake.extractionRef.current ?? ex;

  const review = (r: SenerRecord) => {
    const recurring = r.quantity !== null && r.unit !== "unknown" && !["unknown", "one-time"].includes(r.period);
    openRecord(
      {
        ...r,
        role: ((r.role as string) === "unknown" ? "" : r.role) as Role,
        status: recurring ? "active" : "draft",
      },
      (values) => {
        const latest = current();
        const targets = r.splitGroupId
          ? latest.records
              .filter(
                (row) =>
                  row.splitGroupId === r.splitGroupId &&
                  normCompany(row.company) === normCompany(r.company) &&
                  (row.sourceId || "") === (r.sourceId || ""),
              )
              .map((row) => row.id)
          : [r.id];
        const accepted = new Set([...latest.accepted, ...values.map((v) => v.id)]);
        const records = replaceRows(latest.records, targets, values);
        intake.setExtraction({ ...latest, records, accepted: records.filter((x) => accepted.has(x.id)).map((x) => x.id) });
        intake.openReview();
      },
    );
  };

  const removeSuggestion = (id: string) => {
    const latest = current();
    intake.setExtraction({
      ...latest,
      records: latest.records.filter((x) => x.id !== id),
      accepted: latest.accepted.filter((x) => x !== id),
    });
  };

  const addLine = () =>
    openRecord(null, (values) => {
      const latest = current();
      intake.setExtraction({
        ...latest,
        records: [...latest.records, ...values],
        accepted: [...latest.accepted, ...values.map((v) => v.id)],
      });
      intake.openReview();
    });

  const finishLater = () => {
    closeModal();
    toast("LOI remains shared as Pending review. Resume in LOI Documents or Unsaved drafts.");
  };

  const register = async () => {
    if (registering) return;
    setRegistering(true);
    try {
      await intake.register();
    } finally {
      setRegistering(false);
    }
  };

  const n = ex.accepted.length;
  return (
    <Modal
      title="Review extracted volumes"
      subtitle={ex.filename}
      onClose={closeModal}
      wide
      footer={
        <>
          <button type="button" className={BTN_OUTLINE} onClick={addLine}>
            Add a volume line
          </button>
          <div className="flex gap-2">
            <button type="button" className={BTN_OUTLINE} onClick={finishLater}>
              Finish review later
            </button>
            <button type="button" className={BTN_PRIMARY} disabled={!n || registering} onClick={() => void register()}>
              Register {n} confirmed {n === 1 ? "record" : "records"}
            </button>
          </div>
        </>
      }
    >
      {error && <Notice tone="red">{error}</Notice>}
      <Notice>
        {ex.warnings.length
          ? ex.warnings.map((w, i) => <span key={i} className="block">{w}</span>)
          : "Verify names, products, quantities, units and periods against the original letter."}
        <strong className="block mt-1">Step 1: Review and confirm each volume. Step 2: Click Register confirmed records below.</strong>
        The uploaded letter is shared as Pending review; no unconfirmed volume counts.
      </Notice>
      {ex.records.length ? (
        <div className="space-y-3">
          {ex.records.map((r) => {
            const accepted = ex.accepted.includes(r.id);
            return (
              <div key={r.id} className={`border rounded-lg p-4 ${accepted ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                <strong className="text-slate-800">{r.company || "Company not identified"}</strong>
                <p className="text-sm text-slate-600 mt-1">
                  {ROLE_LABEL[r.role] || "Stage not identified"} · {r.fuels.join(" / ") || "Product unknown"}
                  <br />
                  {r.quantity === null ? "Quantity unknown" : num(r.quantity)} {r.unit} / {r.period} · {r.location || "Location unknown"}
                </p>
                {r.notes && <p className="text-sm text-slate-500 mt-1">{r.notes}</p>}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    type="button"
                    className={accepted ? "bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600" : BTN_OUTLINE}
                    onClick={() => review(r)}
                  >
                    {accepted ? "Confirmed — edit" : "Review and confirm"}
                  </button>
                  <button type="button" className={BTN_TEXT} onClick={() => removeSuggestion(r.id)}>
                    Remove suggestion
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-sm text-slate-500 py-6">No counterparties identified. You can create a record manually.</div>
      )}
      <button
        type="button"
        className={BTN_OUTLINE}
        onClick={() => openViewer({ name: ex.filename, hash: ex.hash, docId: ex.docId, file: ex.original })}
      >
        View original document
      </button>
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-700 font-medium">Read extracted source text</summary>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
          {ex.sourceText}
        </pre>
      </details>
    </Modal>
  );
}
