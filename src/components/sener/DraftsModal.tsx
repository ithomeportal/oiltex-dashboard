"use client";

import { fetchOriginal } from "@/lib/sener/client";
import { groupRows, splitIdentity } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import type { Draft } from "./sener-types";
import { BTN_OUTLINE, BTN_PRIMARY, BTN_TEXT, Modal } from "./ui";

const KIND_LABEL: Record<Draft["kind"], string> = {
  "customer-splits": "Unsaved customer fuel breakdown",
  record: "Unsaved counterparty edit",
  extraction: "Unsaved LOI extraction and confirmed proposals",
};

/** unsaved-drafts.js: resume / discard / export private drafts. */
export default function DraftsModal() {
  const { drafts, closeModal, exportJson, workspace, setModal, openRecord, intake, toast } = useSener();

  const resume = async (draft: Draft) => {
    if (draft.kind === "record") return openRecord(draft.value);
    if (draft.kind === "customer-splits") {
      const stored = draft.value;
      const anchor =
        workspace.records.find((r) => r.id === stored.baseRecordId) ||
        workspace.records.find((r) => r.splitGroupId === stored.docId);
      if (stored.wasEditing && !anchor) {
        return toast("The original customer was removed. Keep/export this draft and rebase it; no shared records changed.");
      }
      if (stored.wasEditing && anchor && JSON.stringify(splitIdentity(anchor)) !== JSON.stringify(stored.originalIdentity)) {
        return toast(
          "The original customer group, company, stage or LOI changed since this draft. Keep/export it and rebase against the current customer; no shared data changed.",
        );
      }
      const current = anchor ? groupRows(anchor, workspace.records) : [];
      const originalIds = stored.originalIds.length ? stored.originalIds : current.map((r) => r.id);
      const removed = originalIds.filter(
        (id) => !workspace.records.some((r) => r.id === id) && stored.records.some((r) => r.id === id),
      );
      if (stored.wasEditing && removed.length) {
        return toast(
          "A saved split was removed since this draft. Keep/export the draft and review the current customer before reapplying; no deleted split was restored.",
        );
      }
      const added = current.filter((r) => !originalIds.includes(r.id) && !stored.records.some((d) => d.id === r.id));
      const record = { ...(anchor || stored.records[0]), ...stored.records[0], id: anchor?.id || stored.records[0].id };
      setModal({ kind: "splits", record, draftRows: [...stored.records, ...added], draftKey: stored.docId });
      if (added.length) toast(`${added.length} new shared split(s) retained. Review the current saved volumes before saving.`);
      return;
    }
    const value = draft.value;
    if (workspace.records.some((r) => r.sourceId === value.docId)) {
      return toast("This LOI is already registered. Keep/export the draft and edit the shared counterparty instead of adding it twice.");
    }
    if (intake.busyRef.current || intake.extractionRef.current) return toast("Finish the current document review first.");
    let original: File | null = null;
    try {
      const blob = value.hash ? await fetchOriginal(value.hash) : null;
      if (blob) original = new File([blob], value.filename, { type: blob.type });
    } catch {
      original = null;
    }
    if (!original) {
      return toast("Original file is not available. Keep/export this draft and reupload its exact original to resume; draft fields are preserved.");
    }
    intake.setExtraction({ ...value, original });
    intake.openReview();
  };

  const discard = (draft: Draft) => {
    drafts.remove(draft.kind, draft.key);
    if (drafts.list.length <= 1) closeModal();
  };

  return (
    <Modal
      title="Unsaved edits and LOI reviews"
      subtitle="These drafts are private to this browser, not registered in the shared workspace."
      onClose={closeModal}
      footer={
        <>
          <button type="button" className={BTN_OUTLINE} onClick={exportJson}>
            Export JSON with drafts
          </button>
          <button type="button" className={BTN_PRIMARY} onClick={closeModal}>
            Close
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        After another user’s edit, cancel the old dialog, refresh shared data, then resume a draft here. Review it against the latest
        shared values before saving. Export JSON includes these draft fields; original files should also be kept separately.
      </p>
      {drafts.list.map((d) => (
        <div key={`${d.kind}:${d.key}`} className="border border-slate-200 rounded-lg p-4">
          <strong className="text-slate-800">{d.kind === "extraction" ? d.value.filename : d.value.company || "Unnamed"}</strong>
          <p className="text-sm text-slate-500">{KIND_LABEL[d.kind]}</p>
          <div className="flex items-center gap-3 mt-2">
            <button type="button" className={BTN_OUTLINE} onClick={() => void resume(d)}>
              Resume draft
            </button>
            <button type="button" className={BTN_TEXT} onClick={() => discard(d)}>
              Discard draft
            </button>
          </div>
        </div>
      ))}
      {!drafts.list.length && <p className="text-sm text-slate-500">No unsaved drafts.</p>}
    </Modal>
  );
}
