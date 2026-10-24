"use client";

import { useSener } from "./SenerContext";
import { BTN_OUTLINE, Icon } from "./ui";

const TONE_DOT = { ok: "bg-green-500", busy: "bg-amber-500", error: "bg-red-500" } as const;

export default function SenerTopBar() {
  const { ws, session, drafts, setModal, modal, exportJson, pickImport, intake, toast } = useSener();
  const isAdmin = Boolean(session?.isAdmin);

  const openClear = () => {
    if (intake.busyRef.current) return toast("Cancel analysis before clearing shared records.");
    if (modal) return toast("Close the current dialog first.");
    setModal({ kind: "clear" });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 text-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="font-medium text-slate-700">SENER permits</span>
        <span>/</span>
        <span className="inline-flex items-center gap-2" aria-live="polite">
          <i className={`inline-block w-2 h-2 rounded-full ${TONE_DOT[ws.status.tone]}`} />
          {ws.status.text}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {drafts.list.length > 0 && (
          <button type="button" className={BTN_OUTLINE} onClick={() => setModal({ kind: "drafts" })}>
            Unsaved drafts ({drafts.list.length})
          </button>
        )}
        <button type="button" className={BTN_OUTLINE} onClick={() => void ws.refresh()} title="Refresh shared records">
          Refresh shared data
        </button>
        <button type="button" className={`${BTN_OUTLINE} inline-flex items-center gap-2`} onClick={exportJson}>
          <Icon name="download" />
          Export JSON
        </button>
        {isAdmin && (
          <button type="button" className={BTN_OUTLINE} onClick={pickImport}>
            Import JSON
          </button>
        )}
        {isAdmin && (
          <button
            type="button"
            className={`${BTN_OUTLINE} text-red-700`}
            onClick={openClear}
            title="Clear shared records and document references for all users"
          >
            Clear shared data
          </button>
        )}
        <button
          type="button"
          onClick={() => setModal({ kind: "info" })}
          aria-label="About this workspace"
          title="About this workspace"
          className="text-slate-500 hover:text-slate-800 p-2"
        >
          <Icon name="info" className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
