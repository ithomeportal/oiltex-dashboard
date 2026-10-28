"use client";

import type { ReactNode } from "react";
import { useSener } from "./SenerContext";
import RecordModal from "./RecordModal";
import CustomerSplitsModal from "./CustomerSplitsModal";
import ReviewModal from "./ReviewModal";
import OriginalViewer from "./OriginalViewer";
import DraftsModal from "./DraftsModal";
import { FailureModal, ProgressModal, UploadModal } from "./IntakeModals";
import { ClearModal, ImportModal, InfoModal, RemoveDocumentModal, SourceModal } from "./WorkspaceModals";

let modalSeq = 0;
const modalKeys = new WeakMap<object, number>();
/** Stable key per modal-state object so re-opening a dialog remounts it with fresh form state. */
function keyOf(m: object): number {
  const existing = modalKeys.get(m);
  if (existing !== undefined) return existing;
  modalSeq += 1;
  modalKeys.set(m, modalSeq);
  return modalSeq;
}

export default function ModalHost() {
  const { modal, viewer } = useSener();

  let content: ReactNode = null;
  if (modal) {
    const key = keyOf(modal);
    switch (modal.kind) {
      case "upload":
        content = <UploadModal key={key} />;
        break;
      case "progress":
        content = <ProgressModal key="progress" modal={modal} />;
        break;
      case "failure":
        content = <FailureModal key={key} modal={modal} />;
        break;
      case "record":
        content = <RecordModal key={key} record={modal.record} onSave={modal.onSave} />;
        break;
      case "splits":
        content = (
          <CustomerSplitsModal
            key={key}
            record={modal.record}
            onSave={modal.onSave}
            draftRows={modal.draftRows}
            draftKey={modal.draftKey}
          />
        );
        break;
      case "review":
        content = <ReviewModal key={key} error={modal.error} />;
        break;
      case "source":
        content = <SourceModal key={key} docId={modal.docId} />;
        break;
      case "removeDoc":
        content = <RemoveDocumentModal key={key} docId={modal.docId} />;
        break;
      case "info":
        content = <InfoModal key={key} />;
        break;
      case "clear":
        content = <ClearModal key={key} />;
        break;
      case "import":
        content = <ImportModal key={key} incoming={modal.incoming} />;
        break;
      case "drafts":
        content = <DraftsModal key={key} />;
        break;
    }
  }

  return (
    <>
      {content}
      {viewer && <OriginalViewer target={viewer} />}
    </>
  );
}
