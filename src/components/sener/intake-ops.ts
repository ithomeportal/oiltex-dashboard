// Pure workspace mutators for the LOI intake flow (port of document-intake.js).
// Each returns a function suitable for `mutate()`; null = no-op.

import type { SenerDocument, SenerRecord, SenerWorkspace } from "@/lib/sener/types";
import { MAX_DOC_TEXT } from "@/lib/sener/types";
import type { ExtractResult } from "@/lib/sener/client";
import { candidateKey, linkedRecords, validateDocumentIndex } from "@/lib/sener/ui-helpers";
import type { Extraction, ModalState } from "./sener-types";
import { newId } from "@/lib/sener/ui-helpers";

export const ANALYSIS_LOCK_MS = 300_000;

export class DocumentRemovedError extends Error {
  readonly documentRemoved = true;
  constructor() {
    super("This uploaded letter was removed by another visitor. It is no longer in shared documents.");
    this.name = "DocumentRemovedError";
  }
}

type DocChange = (doc: SenerDocument, ws: SenerWorkspace) => Partial<SenerDocument> | null;

export function patchDoc(docId: string, change: DocChange) {
  return (ws: SenerWorkspace): SenerWorkspace | null => {
    const doc = ws.documents.find((d) => d.id === docId);
    if (!doc) throw new DocumentRemovedError();
    const update = change(doc, ws);
    if (!update) return null;
    return { ...ws, documents: ws.documents.map((d) => (d.id === docId ? { ...d, ...update } : d)) };
  };
}

export class DocumentRegisteredError extends Error {
  constructor() {
    super("This LOI now has registered volume records. Remove those records first; the document was not removed.");
    this.name = "DocumentRegisteredError";
  }
}

export class DocumentInFlightError extends Error {
  constructor() {
    super("This LOI is still being uploaded or analysed. Try again in a few minutes; the document was not removed.");
    this.name = "DocumentInFlightError";
  }
}

/** True while an upload or analysis of this doc is fresh (same 300 s window as the analysis lock). */
export function isInFlight(doc: SenerDocument, now = Date.now()): boolean {
  const since =
    doc.reviewStatus === "uploading" ? doc.created : doc.reviewStatus === "analyzing" ? doc.analysisStarted : undefined;
  if (!since) return false;
  const started = Date.parse(since);
  return !Number.isNaN(started) && now - started < ANALYSIS_LOCK_MS;
}

/** Removes an unregistered, idle document (failed/pending/duplicate upload). Registered LOIs are refused. */
export function removeDocumentMutator(docId: string, now = Date.now()) {
  return (ws: SenerWorkspace): SenerWorkspace => {
    const doc = ws.documents.find((d) => d.id === docId);
    if (!doc) throw new DocumentRemovedError();
    if (linkedRecords(ws, docId).length) throw new DocumentRegisteredError();
    if (isInFlight(doc, now)) throw new DocumentInFlightError();
    return { ...ws, documents: ws.documents.filter((d) => d.id !== docId) };
  };
}

export function appendUploadingDoc(
  file: File,
  hash: string,
  docId: string,
  uploadedBy: string | null,
  onTarget: (id: string) => void,
) {
  return (ws: SenerWorkspace): SenerWorkspace | null => {
    const existing = ws.documents.find((d) => d.hash === hash);
    if (existing) {
      onTarget(existing.id);
      return null;
    }
    onTarget(docId);
    const doc: SenerDocument = {
      id: docId,
      name: file.name,
      hash,
      created: new Date().toISOString(),
      reviewStatus: "uploading",
      originalAvailable: false,
      originalSize: file.size,
      originalMime: file.type,
      warnings: [],
      ...(uploadedBy ? { uploadedBy } : {}),
    };
    return { ...ws, documents: [...ws.documents, doc] };
  };
}

export const markOriginalSaved = (file: File): DocChange => (current, ws) => ({
  originalAvailable: true,
  originalSize: file.size,
  originalMime: file.type,
  ...(!linkedRecords(ws, current.id).length && current.reviewStatus === "uploading"
    ? { reviewStatus: "pending_review" as const }
    : {}),
});

/** Claim the shared analysis lock unless another visitor holds a fresh one. */
export const claimAnalysis =
  (token: string, onOwned: (owned: boolean) => void): DocChange =>
  (current, ws) => {
    onOwned(false);
    if (linkedRecords(ws, current.id).length || current.proposedRecords?.length) return null;
    const started = Date.parse(current.analysisStarted || "");
    if (current.reviewStatus === "analyzing" && Date.now() - started < ANALYSIS_LOCK_MS) return null;
    onOwned(true);
    return {
      reviewStatus: "analyzing",
      analysisToken: token,
      analysisStarted: new Date().toISOString(),
      analysisError: "",
    };
  };

export const failStart =
  (message: string): DocChange =>
  (current, ws) =>
    linkedRecords(ws, current.id).length
      ? null
      : { reviewStatus: current.originalAvailable ? "analysis_failed" : "upload_failed", analysisError: message };

export const failAnalysis =
  (token: string | null, message: string): DocChange =>
  (doc, ws) =>
    linkedRecords(ws, doc.id).length || (token && doc.analysisToken !== token)
      ? null
      : { reviewStatus: "analysis_failed", analysisError: message };

export const saveProposals =
  (token: string, data: ExtractResult): DocChange =>
  (doc, ws) => {
    if (linkedRecords(ws, doc.id).length) return null;
    if (doc.analysisToken !== token) {
      throw new Error(
        "Another visitor restarted this analysis. Your letter remains shared; resume the latest review in LOI Documents.",
      );
    }
    const text = data.sourceText.slice(0, MAX_DOC_TEXT);
    const duplicate = ws.documents.find((o) => o.id !== doc.id && data.fingerprint && o.fingerprint === data.fingerprint);
    if (duplicate) {
      return {
        reviewStatus: "duplicate",
        duplicateOf: duplicate.id,
        analysisError: `Same extracted text as ${duplicate.name}. No duplicate volumes registered.`,
        proposedRecords: [],
        text,
        warnings: data.warnings || [],
      };
    }
    return {
      reviewStatus: "pending_review",
      fingerprint: data.fingerprint,
      text,
      warnings: data.warnings || [],
      proposedRecords: data.records.map((r) => ({ ...r, status: "draft" as const })),
      analysisError: "",
      analysisCompleted: new Date().toISOString(),
    };
  };

/** Append-only registration; identical retry is a no-op; a different second registration is refused. */
export function registerMutator(docId: string, records: SenerRecord[], metadata: Partial<SenerDocument>) {
  return (ws: SenerWorkspace): SenerWorkspace | null => {
    const doc = ws.documents.find((d) => d.id === docId);
    if (!doc) throw new Error("This uploaded letter is no longer in the shared register. Reupload its original.");
    if (metadata.hash && metadata.hash !== doc.hash) {
      throw new Error("The shared original changed; review the correct document before registering.");
    }
    if (doc.reviewStatus === "duplicate") {
      throw new Error("This letter duplicates another source. Use the existing letter; no duplicate volumes were added.");
    }
    const existing = linkedRecords(ws, docId);
    if (existing.length) {
      const same = records.every((row) => existing.some((s) => s.id === row.id && candidateKey(s) === candidateKey(row)));
      if (same) return null;
      throw new Error(
        "Another visitor already registered this LOI. Close this review and edit its shared counterparty records; no duplicate volumes were added.",
      );
    }
    const next: SenerWorkspace = {
      ...ws,
      records: [...ws.records, ...records.map((r) => ({ ...r, sourceId: docId, sourceName: doc.name }))],
      documents: ws.documents.map((d) =>
        d.id === docId
          ? {
              ...d,
              ...metadata,
              id: d.id,
              name: d.name,
              created: d.created,
              text: metadata.text || d.text,
              fingerprint: metadata.fingerprint || d.fingerprint,
              reviewStatus: "registered" as const,
              proposedRecords: [],
              analysisError: "",
            }
          : d,
      ),
    };
    validateDocumentIndex(next);
    return next;
  };
}

export function extractionFrom(doc: SenerDocument, file: File | null = null): Extraction {
  return {
    docId: doc.id,
    filename: doc.name,
    hash: doc.hash,
    fingerprint: doc.fingerprint,
    sourceText: doc.text || "",
    warnings: doc.warnings || [],
    records: (doc.proposedRecords || []).map((r) => ({ ...r, status: "draft" as const })),
    accepted: [],
    original: file,
  };
}

/** Document metadata written on registration (app.js register-extraction). */
export function registrationMetadata(ex: Extraction, existing: SenerDocument | undefined): Partial<SenerDocument> {
  const unconfirmed = ex.records.filter((r) => !ex.accepted.includes(r.id));
  const warnings = [
    ...ex.warnings,
    ...(unconfirmed.length
      ? [
          `${unconfirmed.length} unconfirmed proposal(s) were not added to balances. See the original and archived proposals before adding further volumes.`,
        ]
      : []),
    ...(ex.sourceText.length > MAX_DOC_TEXT
      ? ["Stored text is truncated to 20,000 characters; Keep the original file as your authoritative source."]
      : []),
  ];
  return {
    hash: ex.hash,
    fingerprint: ex.fingerprint,
    originalAvailable: true,
    originalSize: ex.original?.size || existing?.originalSize || 0,
    originalMime: ex.original?.type || existing?.originalMime || "",
    text: ex.sourceText.slice(0, MAX_DOC_TEXT),
    unconfirmedProposals: unconfirmed.map((r) => ({ ...r, status: "draft" as const })),
    warnings,
  };
}

interface FailureArgs {
  removed: boolean;
  stillShared: string | null;
  message: string;
  filename: string;
  onRetry: () => void;
}

/** Failure dialog after an unsuccessful upload/analysis (app.js analyzeFile catch). */
export function failureModal({ removed, stillShared, message, filename, onRetry }: FailureArgs): ModalState {
  return {
    kind: "failure",
    title: removed ? "LOI no longer shared" : stillShared ? "LOI saved — review still needed" : "Upload NOT shared",
    subtitle: removed
      ? "Another visitor removed this document. It is not in the shared register."
      : stillShared
        ? "The shared document entry remains visible. No new volumes were registered."
        : "The upload did not complete; do not assume others can see it.",
    message,
    detail: removed
      ? "This letter was removed. Reupload only if it should be restored."
      : stillShared
        ? "Find this letter in LOI Documents. If the original upload failed, reattach it. Reviewed volumes count only after confirmation and registration."
        : "Keep your original and retry. Existing shared records are unchanged.",
    onRetry,
    manualRecord: stillShared
      ? {
          id: newId(),
          company: "",
          role: "" as unknown as SenerRecord["role"],
          fuels: [],
          quantity: null,
          unit: "unknown",
          period: "unknown",
          status: "draft",
          sourceId: stillShared,
          sourceName: filename,
          notes: "Manually reviewed after unsuccessful extraction.",
        }
      : null,
  };
}
