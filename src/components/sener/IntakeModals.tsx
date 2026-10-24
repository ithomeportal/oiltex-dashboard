"use client";

import type { ModalState } from "./sener-types";
import { useSener } from "./SenerContext";
import DropTile from "./DropTile";
import { BTN_OUTLINE, BTN_PRIMARY, Modal, Notice, RefBox, Spinner } from "./ui";

export function UploadModal() {
  const { closeModal } = useSener();
  return (
    <Modal
      title="Upload a letter of intent"
      subtitle="We’ll identify the counterparty and propose volume records for your review."
      onClose={closeModal}
    >
      <DropTile variant="modal" />
      <RefBox>
        Documents are processed transiently by text extraction/OCR and AI. The original and a Pending review entry are saved
        for everyone before analysis. Volumes count only after you review, confirm and register them. PDF/Word previews and
        original downloads are available in LOI Documents. All signed-in OilTex users share this workspace.
      </RefBox>
    </Modal>
  );
}

export function ProgressModal({ modal }: { modal: Extract<ModalState, { kind: "progress" }> }) {
  const { toast } = useSener();
  return (
    <Modal
      title="Saving your LOI for the team"
      subtitle="Upload → Review and confirm → Register volumes"
      onClose={() => toast("Use Cancel analysis to stop the request.")}
    >
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <Spinner />
        <h3 className="text-base font-semibold text-slate-800 break-all">{modal.filename}</h3>
        <p className="text-sm text-slate-500 max-w-md">{modal.message}</p>
        <p className="text-xs text-slate-400">Analysis can take one to two minutes.</p>
        <button type="button" className={BTN_OUTLINE} onClick={modal.onCancel}>
          Cancel analysis
        </button>
      </div>
    </Modal>
  );
}

export function FailureModal({ modal }: { modal: Extract<ModalState, { kind: "failure" }> }) {
  const { closeModal, intake, openRecord } = useSener();
  const close = () => {
    closeModal();
    intake.next();
  };
  return (
    <Modal
      title={modal.title}
      subtitle={modal.subtitle}
      onClose={close}
      footer={
        <>
          <button type="button" className={BTN_OUTLINE} onClick={() => openRecord(modal.manualRecord)}>
            Enter manually
          </button>
          <div className="flex gap-2">
            <button type="button" className={BTN_OUTLINE} onClick={close}>
              Close
            </button>
            <button type="button" className={BTN_PRIMARY} onClick={modal.onRetry}>
              Retry upload / analysis
            </button>
          </div>
        </>
      }
    >
      <Notice tone="red">{modal.message}</Notice>
      <p className="text-sm text-slate-600">{modal.detail}</p>
    </Modal>
  );
}
