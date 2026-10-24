"use client";

// LOI intake flow — port of app.js analyzeFile/register + document-intake.js
// + customer-register.js reviewDocument. Upload → shared pending doc → analysis
// lock → extraction → review → append-only registration.

import { useCallback, useEffect, useRef, useState } from "react";
import type { SenerDocument, SenerRecord, SenerWorkspace } from "@/lib/sener/types";
import { extractDocument, fetchOriginal, type SenerWorkspaceApi } from "@/lib/sener/client";
import {
  ACCEPTED_EXT_RE,
  MAX_UPLOAD_BYTES,
  errorMessage,
  linkedRecords,
  newId,
  sha256Hex,
} from "@/lib/sener/ui-helpers";
import {
  DocumentRemovedError,
  appendUploadingDoc,
  claimAnalysis,
  extractionFrom,
  failAnalysis,
  failureModal,
  failStart,
  markOriginalSaved,
  patchDoc,
  registerMutator,
  registrationMetadata,
  saveProposals,
} from "./intake-ops";
import { checkRecords, uploadOriginal } from "./upload";
import type { Extraction, ModalState, ViewerTarget } from "./sener-types";
import type { DraftsApi } from "./useDrafts";

export interface IntakeDeps {
  ws: SenerWorkspaceApi;
  workspace: SenerWorkspace;
  email: string | null;
  setModal: (m: ModalState | null) => void;
  toast: (text: string) => void;
  goDocuments: () => void;
  openViewer: (t: ViewerTarget) => void;
  drafts: DraftsApi;
}

interface StartResult {
  doc: SenerDocument;
  token?: string | null;
  registered?: boolean;
  duplicate?: boolean;
  resume?: boolean;
  inProgress?: boolean;
}

type IntakeError = Error & { sharedDocumentId?: string; documentRemoved?: boolean };

const isRemoved = (e: unknown) => e instanceof DocumentRemovedError || Boolean((e as IntakeError)?.documentRemoved);
const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

export function useIntake(deps: IntakeDeps) {
  const d = useRef(deps);
  useEffect(() => {
    d.current = deps;
  });
  const [extraction, setExtractionState] = useState<Extraction | null>(null);
  const [uploadBusy, setUploadBusyState] = useState(false);
  const extractionRef = useRef<Extraction | null>(null);
  const busyRef = useRef(false);
  const queueRef = useRef<File[]>([]);
  const analyzeRef = useRef<(file: File, existing?: SenerDocument | null) => Promise<void>>(async () => {});

  const setExtraction = useCallback((x: Extraction | null) => {
    extractionRef.current = x;
    setExtractionState(x);
  }, []);
  const setBusy = useCallback((b: boolean) => {
    busyRef.current = b;
    setUploadBusyState(b);
  }, []);

  const next = useCallback(() => {
    if (busyRef.current || extractionRef.current || !queueRef.current.length) return;
    const [file, ...rest] = queueRef.current;
    queueRef.current = rest;
    void analyzeRef.current(file);
  }, []);

  const patch = useCallback(async (docId: string, change: Parameters<typeof patchDoc>[1]) => {
    const result = await d.current.ws.mutate(patchDoc(docId, change));
    const doc = result.workspace.documents.find((x) => x.id === docId) as SenerDocument;
    return { doc, registered: linkedRecords(result.workspace, docId).length > 0 };
  }, []);

  const start = useCallback(
    async (file: File, hash: string, signal?: AbortSignal): Promise<StartResult> => {
      let targetId = "";
      const created = await d.current.ws.mutate(
        appendUploadingDoc(file, hash, newId(), d.current.email, (id) => {
          targetId = id;
        }),
      );
      let doc = created.workspace.documents.find((x) => x.id === targetId) as SenerDocument;
      try {
        if (!doc.originalAvailable) await uploadOriginal(file, hash, signal);
        const updated = await patch(targetId, markOriginalSaved(file));
        doc = updated.doc;
        if (updated.registered) return { doc, registered: true };
        if (doc.reviewStatus === "duplicate") return { doc, duplicate: true };
        if (doc.proposedRecords?.length) return { doc, resume: true };
        let owned = false;
        const token = newId();
        const analysis = await patch(
          targetId,
          claimAnalysis(token, (o) => {
            owned = o;
          }),
        );
        if (analysis.registered) return { doc: analysis.doc, registered: true };
        const hasProposals = Boolean(analysis.doc.proposedRecords?.length);
        return {
          doc: analysis.doc,
          token: owned ? token : null,
          resume: hasProposals,
          inProgress: !owned && !hasProposals,
        };
      } catch (error) {
        let removed = isRemoved(error);
        if (!removed) {
          try {
            await patch(targetId, failStart(errorMessage(error)));
          } catch (patchError) {
            removed = isRemoved(patchError);
          }
        }
        const annotated = (error instanceof Error ? error : new Error(String(error))) as IntakeError;
        annotated.documentRemoved = removed;
        if (!removed) annotated.sharedDocumentId = targetId;
        throw annotated;
      }
    },
    [patch],
  );

  const openReview = useCallback((error?: string) => d.current.setModal({ kind: "review", error }), []);

  const analyzeFile = useCallback(
    async (file: File, existing: SenerDocument | null = null) => {
      const { toast, setModal, goDocuments, openViewer } = d.current;
      if (file.size > MAX_UPLOAD_BYTES) {
        toast("File exceeds 15 MB.");
        next();
        return;
      }
      if (!ACCEPTED_EXT_RE.test(file.name)) {
        toast("Unsupported file. Use PDF, DOCX, TXT or an image.");
        next();
        return;
      }
      setBusy(true);
      let sharedDocId: string | null = null;
      let token: string | null = null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 240_000);
      const progress = (message: string) =>
        setModal({ kind: "progress", filename: file.name, message, onCancel: () => controller.abort() });
      const stop = (after?: () => void) => {
        setBusy(false);
        setModal(null);
        after?.();
      };
      progress("Saving a shared document entry and uploading the original. Unconfirmed volumes will not count.");
      try {
        const hash = await sha256Hex(file);
        if (existing?.hash && hash !== existing.hash) throw new Error("Reattach the exact original before review.");
        const started = await start(file, hash, controller.signal);
        sharedDocId = started.doc.id;
        token = started.token ?? null;
        if (started.registered) {
          stop();
          toast("This LOI is already registered for everyone. No duplicate records added.");
          openViewer({ name: started.doc.name, hash, docId: started.doc.id });
          return;
        }
        if (started.duplicate) {
          stop(goDocuments);
          toast(started.doc.analysisError || "Duplicate letter; no volumes counted.");
          next();
          return;
        }
        if (started.resume) {
          setExtraction(extractionFrom(started.doc, file));
          setBusy(false);
          openReview();
          return;
        }
        if (started.inProgress || !token) {
          stop(goDocuments);
          toast("This LOI is shared. Another analysis is running; open Review LOI after it completes.");
          next();
          return;
        }
        if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
        progress("Original saved for everyone. Reading text and proposing volumes; you can finish review later from LOI Documents.");
        const data = await extractDocument(hash, controller.signal);
        if (!Array.isArray(data.records) || typeof data.sourceText !== "string") {
          throw new Error("The analysis response was incomplete. Retry from LOI Documents.");
        }
        if (data.hash && data.hash !== hash) throw new Error("Analysis file hash did not match your original.");
        const prepared = {
          ...data,
          records: data.records.map((r): SenerRecord => ({ ...r, id: newId(), status: "draft" })),
        };
        const saved = await patch(started.doc.id, saveProposals(token, prepared));
        if (saved.registered) {
          stop();
          toast("Another visitor registered this LOI. Your shared records are up to date.");
          next();
          return;
        }
        if (saved.doc.reviewStatus === "duplicate") {
          stop(goDocuments);
          toast(saved.doc.analysisError || "Duplicate letter; no volumes counted.");
          next();
          return;
        }
        setExtraction(extractionFrom(saved.doc, file));
        setBusy(false);
        openReview();
      } catch (error) {
        setBusy(false);
        let removed = isRemoved(error);
        const docId = removed ? null : sharedDocId || (error as IntakeError)?.sharedDocumentId || null;
        const message =
          isAbort(error) || controller.signal.aborted
            ? "Analysis stopped or timed out. The letter remains pending; retry analysis or review manually."
            : errorMessage(error, "Analysis failed.");
        if (docId && token) {
          try {
            await patch(docId, failAnalysis(token, message));
          } catch (patchError) {
            if (isRemoved(patchError)) removed = true;
          }
        }
        const stillShared = removed ? null : docId;
        setModal(
          failureModal({
            removed,
            stillShared,
            message,
            filename: file.name,
            onRetry: () => {
              const doc = stillShared ? d.current.workspace.documents.find((x) => x.id === stillShared) : null;
              void analyzeRef.current(file, doc ?? existing);
            },
          }),
        );
      } finally {
        clearTimeout(timeout);
      }
    },
    [next, openReview, patch, setBusy, setExtraction, start],
  );
  useEffect(() => {
    analyzeRef.current = analyzeFile;
  }, [analyzeFile]);

  const enqueue = useCallback(
    (files: File[]) => {
      if (busyRef.current || extractionRef.current) {
        d.current.toast("Complete the current document review before adding another.");
        return;
      }
      queueRef.current = [...files];
      next();
    },
    [next],
  );

  const reviewPendingCustomer = useCallback(
    async (docId: string) => {
      const { toast, workspace, openViewer } = d.current;
      if (busyRef.current || extractionRef.current) {
        toast("Finish the current document review first.");
        return;
      }
      const doc = workspace.documents.find((x) => x.id === docId);
      if (!doc || linkedRecords(workspace, docId).length) {
        toast("This LOI already has registered records. Refresh the list to review them.");
        return;
      }
      if (doc.proposedRecords?.length) {
        setExtraction(extractionFrom(doc));
        openReview();
        return;
      }
      try {
        const blob = doc.hash ? await fetchOriginal(doc.hash) : null;
        if (!blob) {
          toast("Reattach the exact original in LOI Documents, then select Review LOI again.");
          openViewer({ name: doc.name, hash: doc.hash, docId: doc.id });
          return;
        }
        await analyzeFile(new File([blob], doc.name, { type: blob.type }), doc);
      } catch (error) {
        toast(errorMessage(error, "Original could not be retrieved. Reattach it in LOI Documents."));
      }
    },
    [analyzeFile, openReview, setExtraction],
  );

  const resume = useCallback(
    async (docId: string) => {
      const { toast, workspace } = d.current;
      if (busyRef.current || extractionRef.current) {
        toast("Finish or save the current review for later first.");
        return;
      }
      const doc = workspace.documents.find((x) => x.id === docId);
      if (!doc) return toast("Refresh the shared document list.");
      if (linkedRecords(workspace, docId).length) return toast("This LOI is registered. Edit its counterparty records instead.");
      if (doc.reviewStatus === "duplicate") return toast(doc.analysisError || "Duplicate source; no volumes added.");
      if (doc.proposedRecords?.length) {
        setExtraction(extractionFrom(doc));
        openReview();
        return;
      }
      await reviewPendingCustomer(docId);
    },
    [openReview, reviewPendingCustomer, setExtraction],
  );

  const register = useCallback(async () => {
    const ex = extractionRef.current;
    if (!ex || !ex.accepted.length) return;
    const { ws, workspace, drafts, toast, setModal } = d.current;
    const existingDoc = workspace.documents.find((x) => x.id === ex.docId);
    const metadata = registrationMetadata(ex, existingDoc);
    const accepted = ex.records.filter((r) => ex.accepted.includes(r.id));
    try {
      checkRecords(accepted);
      let docId = ex.docId;
      if (!existingDoc) {
        if (!ex.original || !ex.hash) throw new Error("Reupload the original before registering this older private draft.");
        const prepared = await start(ex.original, ex.hash);
        if (prepared.registered) throw new Error("This original is already registered. Review its shared counterparty records.");
        docId = prepared.doc.id;
      }
      const records = accepted.map((r) => ({ ...r, sourceId: docId, sourceName: ex.filename }));
      await ws.mutate(registerMutator(docId, records, metadata));
      drafts.remove("extraction", ex.docId);
      if (docId !== ex.docId) drafts.remove("extraction", docId);
      setExtraction(null);
      setModal(null);
      toast(`${records.length} reviewed volume record(s) registered for everyone.`);
      next();
    } catch (error) {
      const message = errorMessage(error);
      drafts.preserveExtraction(ex);
      openReview("Volumes NOT registered: " + message);
      toast(message);
    }
  }, [next, openReview, setExtraction, start]);

  const reset = useCallback(() => {
    queueRef.current = [];
    setExtraction(null);
  }, [setExtraction]);

  return {
    extraction,
    extractionRef,
    setExtraction,
    uploadBusy,
    busyRef,
    analyzeFile,
    enqueue,
    next,
    resume,
    reviewPendingCustomer,
    register,
    openReview,
    reset,
  };
}

export type IntakeApi = ReturnType<typeof useIntake>;
