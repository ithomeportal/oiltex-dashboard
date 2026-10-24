"use client";

import { useEffect, useState } from "react";
import { fetchOriginal, fetchWordPreview, fileUrl } from "@/lib/sener/client";
import { errorMessage, extOf, num } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import type { ViewerTarget } from "./sener-types";
import { BTN_OUTLINE, BTN_PRIMARY, Icon, Modal, Spinner } from "./ui";

type ViewState =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "ready"; url: string; ext: string; size: number; text?: string; html?: string; wordLoading?: boolean };

const IMAGE_EXT = ["png", "jpg", "jpeg", "webp"];

/** Separate stacked dialog (viewer.js) so an edit/review dialog underneath keeps its state. */
export default function OriginalViewer({ target }: { target: ViewerTarget }) {
  const { closeViewer, workspace, beginAttach } = useSener();
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const pending = Boolean(target.file);

  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    const run = async () => {
      setState({ kind: "loading" });
      try {
        const blob = target.file ?? (target.hash ? await fetchOriginal(target.hash, controller.signal) : null);
        if (controller.signal.aborted) return;
        if (!blob) return setState({ kind: "missing" });
        const ext = extOf(target.file?.name || target.name);
        url = URL.createObjectURL(blob);
        const base = { kind: "ready" as const, url, ext, size: blob.size };
        if (ext === "txt" || ext === "md") {
          const text = await blob.text();
          if (!controller.signal.aborted) setState({ ...base, text });
        } else if (ext === "docx" && target.hash) {
          setState({ ...base, wordLoading: true });
          const { html } = await fetchWordPreview(target.hash, controller.signal);
          if (!controller.signal.aborted) setState({ ...base, html });
        } else setState(base);
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ kind: "error", message: errorMessage(error, "Preview unavailable.") });
      }
    };
    void run();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [target, attempt]);

  const doc = target.docId ? workspace.documents.find((d) => d.id === target.docId) : undefined;
  const subtitle = pending
    ? "Pending original · not yet registered"
    : "Original document · shared with every signed-in OilTex user";

  return (
    <Modal title={target.name || "Original document"} subtitle={subtitle} onClose={closeViewer} wide layer="top">
      {state.kind === "ready" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span>
            {state.ext.toUpperCase()} · {num(state.size / 1024, 1)} KB
          </span>
          <a className={`${BTN_OUTLINE} inline-flex items-center gap-2`} href={target.hash && !pending ? fileUrl(target.hash, true) : state.url} download={target.name}>
            <Icon name="download" /> Download original
          </a>
          <a className={BTN_OUTLINE} href={target.hash && !pending ? fileUrl(target.hash) : state.url} target="_blank" rel="noopener noreferrer">
            Open in new tab
          </a>
        </div>
      )}
      <ViewerBody
        state={state}
        name={target.name}
        canAttach={Boolean(doc?.hash)}
        onAttach={() => doc && beginAttach(doc)}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    </Modal>
  );
}

interface BodyProps {
  state: ViewState;
  name: string;
  canAttach: boolean;
  onAttach: () => void;
  onRetry: () => void;
}

function ViewerBody({ state, name, canAttach, onAttach, onRetry }: BodyProps) {
  if (state.kind === "loading") return <div className="text-center text-sm text-slate-500 py-10">Loading original file…</div>;
  if (state.kind === "missing") {
    return (
      <div className="text-center py-8 space-y-3">
        <h3 className="text-base font-semibold text-slate-800">Original file needs to be reattached</h3>
        <p className="text-sm text-slate-500 max-w-lg mx-auto">
          This entry was saved as an extraction only, or the original has not been uploaded to shared storage. Select the exact
          original to share and restore viewing without adding duplicate volume records.
        </p>
        {canAttach ? (
          <button type="button" className={BTN_PRIMARY} onClick={onAttach}>
            Reattach original file
          </button>
        ) : (
          <p className="text-sm text-slate-500">This reference has no original-file hash.</p>
        )}
        <small className="block text-xs text-slate-400">JSON backups contain records and extracted text, not original file bytes.</small>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="text-center py-8 space-y-3">
        <h3 className="text-base font-semibold text-slate-800">Preview unavailable</h3>
        <p className="text-sm text-slate-500">{state.message}</p>
        <button type="button" className={BTN_OUTLINE} onClick={onRetry}>
          Retry preview
        </button>
      </div>
    );
  }
  if (state.ext === "pdf") {
    return (
      <>
        <iframe title={`${name} original document preview`} src={`${state.url}#toolbar=1&navpanes=0`} className="w-full h-[70vh] border border-slate-200 rounded-lg" />
        <p className="text-xs text-slate-500">
          If the embedded PDF is blank or blocked by your browser, use Open in new tab or Download original.
        </p>
      </>
    );
  }
  if (state.ext === "docx") {
    if (state.wordLoading) {
      return (
        <div className="flex flex-col items-center gap-3 py-10 text-sm text-slate-500">
          <Spinner />
          Preparing Word preview…
        </div>
      );
    }
    return (
      <>
        <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-3 py-2">
          Formatting may differ from Word — download the original for the authoritative copy.
        </div>
        <iframe title={`${name} Word preview`} sandbox="" srcDoc={state.html ?? ""} className="w-full h-[70vh] border border-slate-200 rounded-lg bg-white" />
      </>
    );
  }
  if (IMAGE_EXT.includes(state.ext)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={state.url} alt={`${name} original document`} className="max-w-full mx-auto border border-slate-200 rounded-lg" />;
  }
  if (state.text !== undefined) {
    return <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700">{state.text}</pre>;
  }
  return <div className="text-center text-sm text-slate-500 py-10">Inline viewing is not supported for this format. Download the original to open it in its application.</div>;
}
