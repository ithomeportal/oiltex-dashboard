"use client";

import { useEffect, useState } from "react";
import { EMPTY_WORKSPACE, type SenerWorkspace } from "@/lib/sener/types";
import { fetchHistory, type HistoryEntry } from "@/lib/sener/client";
import { errorMessage } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { mergeWorkspaces } from "./import-merge";
import { removeDocumentMutator } from "./intake-ops";
import { BTN_DANGER, BTN_OUTLINE, BTN_PRIMARY, Modal, Notice } from "./ui";

const count = (v: number | unknown[]) => (Array.isArray(v) ? v.length : v);

export function InfoModal() {
  const { closeModal } = useSener();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory()
      .then(setHistory)
      .catch((e) => setHistoryError(errorMessage(e, "Change history unavailable.")));
  }, []);

  return (
    <Modal
      title="About this workspace"
      subtitle="Oil Tex · supply, transport and demand planning"
      onClose={closeModal}
      footer={
        <>
          <span />
          <button type="button" className={BTN_PRIMARY} onClick={closeModal}>
            Understood
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-600">
        <p>
          <strong>This is a shared workspace.</strong> Every signed-in OilTex user views and edits the same records and registered
          originals. Changes are stored in the shared database and reflected across all views within about ten seconds. A stale
          concurrent save is rejected instead of overwriting another user’s changes.
        </p>
        <p>
          <strong>Document handling:</strong> files are sent to text extraction and AI. Only reviewed registered fields count. JSON
          exports omit original bytes, which can be downloaded in LOI Documents.
        </p>
        <p>
          <strong>Volume rules:</strong> 1 US liquid gallon = 3.785411784 liters. Monthly, 30 days per operational month, 52/12
          weeks per month or 1/12 of annual volume. Calculation periods: monthly ×1, quarterly ×3, semester ×6, annual ×12. These
          are steady-rate projections, not calendar periods or expiry-prorated forecasts. Only active, currently valid recurring
          records count.
        </p>
        <p>
          <strong>Product matching:</strong> multiproduct supplier and transporter capacities are shared and counted once. Fuel-filter
          views are independent planning runs; their matches must not be added together.
        </p>
        <Notice tone="amber">
          <strong>Permit caveat.</strong> Non-binding letters describe potential—not guaranteed—supply, transport or sales. Contract
          labels do not certify enforceability. This is volume planning, not a SENER submission, legal sufficiency, product
          eligibility certification or physical-route validation. No government record is submitted by this site.
        </Notice>
        <p>Fuel filters, reporting periods, sorting and what-if sliders are personal display choices; edits to source records are shared.</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Change history</h3>
        {historyError && <p className="text-sm text-red-700">{historyError}</p>}
        {!history && !historyError && <p className="text-sm text-slate-500">Loading…</p>}
        {history && !history.length && <p className="text-sm text-slate-500">No saved revisions yet.</p>}
        {history && history.length > 0 && (
          <ul className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
            {history.map((h) => (
              <li key={h.revision} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span className="font-medium text-slate-700">Revision {h.revision}</span>
                <span className="text-slate-500">
                  {new Date(h.updatedAt).toLocaleString("en-US")} · {h.updatedBy || "unknown user"}
                </span>
                <span className="text-slate-500">
                  {count(h.records)} records · {count(h.documents)} documents
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export function ClearModal() {
  const { closeModal, exportJson, ws, afterClear } = useSener();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = async () => {
    setBusy(true);
    try {
      await ws.save(EMPTY_WORKSPACE);
      afterClear();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Clear shared data for everyone?"
      subtitle="This affects every user of the SENER workspace."
      onClose={() => !busy && closeModal()}
      footer={
        <>
          <button type="button" className={BTN_OUTLINE} onClick={exportJson}>
            Export JSON first
          </button>
          <div className="flex gap-2">
            <button type="button" className={BTN_OUTLINE} disabled={busy} onClick={closeModal}>
              Keep shared data
            </button>
            {step === 1 ? (
              <button type="button" className={BTN_DANGER} onClick={() => setStep(2)}>
                Clear shared data for everyone
              </button>
            ) : (
              <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => void clear()}>
                Yes, permanently clear for everyone
              </button>
            )}
          </div>
        </>
      }
    >
      <Notice tone="red">
        <strong>Remove all shared supplier, transporter, customer, contract and LOI records, extracted text and document references.</strong>
        <br />
        All shared dashboard totals become zero for everyone.
      </Notice>
      <p className="text-sm text-slate-600">
        Original files will disappear from the document register, but this action does not physically erase stored object bytes.
        Downloaded copies are untouched. Export JSON and download originals before clearing if you need a backup.
      </p>
      {step === 2 && <Notice tone="amber">Second confirmation: are you sure? Every user will see an empty workspace.</Notice>}
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  );
}

export function ImportModal({ incoming }: { incoming: SenerWorkspace }) {
  const { closeModal, ws, workspace, setModal, toast } = useSener();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    try {
      await ws.save(mergeWorkspaces(workspace, incoming));
      setModal(null);
      toast("Backup merged and shared. Original bytes are not included in JSON; missing originals can be reattached in LOI Documents.");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Merge backup into shared workspace?"
      subtitle="Existing shared records will not be replaced."
      onClose={closeModal}
      footer={
        <>
          <button type="button" className={BTN_OUTLINE} onClick={closeModal}>
            Cancel
          </button>
          <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void confirm()}>
            Merge &amp; share
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        {incoming.records.length} records and {incoming.documents.length} document references will be checked and shared with all
        users. Exact duplicates are skipped; conflicting IDs stop the merge.
      </p>
      <p className="text-sm text-slate-600">Original bytes are not included in JSON. Missing files can be reattached later.</p>
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  );
}

export function SourceModal({ docId }: { docId: string }) {
  const { closeModal, workspace } = useSener();
  const doc = workspace.documents.find((d) => d.id === docId);
  if (!doc) return null;
  const linked = workspace.records.filter((r) => r.sourceId === doc.id).length;
  return (
    <Modal
      title={doc.name}
      subtitle="Extracted text only. Use View original to see the PDF/Word file."
      onClose={closeModal}
      wide
      footer={
        <>
          <span />
          <button type="button" className={BTN_OUTLINE} onClick={closeModal}>
            Close
          </button>
        </>
      }
    >
      {(doc.warnings || []).length > 0 && (
        <Notice tone="amber">
          {(doc.warnings || []).map((w, i) => <span key={i} className="block">{w}</span>)}
        </Notice>
      )}
      <p className="text-sm text-slate-600">Linked volume records: {linked}</p>
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700">
        {doc.text || "No extracted text stored for this document."}
      </pre>
    </Modal>
  );
}

/** Removes one unregistered, idle LOI (failed, pending or duplicate upload) from the shared register. */
export function RemoveDocumentModal({ docId }: { docId: string }) {
  const { closeModal, ws, workspace, drafts, intake, toast } = useSener();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doc = workspace.documents.find((d) => d.id === docId);

  const remove = async () => {
    if (intake.extractionRef.current?.docId === docId) {
      setError("Finish or close the current review of this LOI first.");
      return;
    }
    if (intake.busyRef.current) {
      setError("Wait for your current upload or analysis to finish first.");
      return;
    }
    setBusy(true);
    try {
      await ws.mutate(removeDocumentMutator(docId));
      drafts.remove("extraction", docId);
      closeModal();
      toast("Document removed from the shared register.");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Remove this document?"
      subtitle="It disappears from LOI Documents for everyone."
      onClose={() => !busy && closeModal()}
      footer={
        <>
          <span />
          <div className="flex gap-2">
            <button type="button" className={BTN_OUTLINE} disabled={busy} onClick={closeModal}>
              Keep document
            </button>
            <button type="button" className={BTN_DANGER} disabled={busy || !doc} onClick={() => void remove()}>
              Remove document
            </button>
          </div>
        </>
      }
    >
      {doc ? (
        <>
          <strong className="text-slate-800 break-all">{doc.name}</strong>
          <p className="text-sm text-slate-600">
            No volume records are registered from this letter, so balances do not change. The stored original is not erased and
            the previous revision stays in change history.
          </p>
        </>
      ) : (
        <Notice tone="amber">This document is no longer in the shared register.</Notice>
      )}
      {error && <Notice tone="red">{error}</Notice>}
    </Modal>
  );
}
