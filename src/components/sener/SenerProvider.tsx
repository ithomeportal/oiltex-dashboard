"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { calculate, currentUtcDate } from "@/lib/sener/calculator";
import { EMPTY_WORKSPACE, HORIZONS, type Horizon, type Role, type SenerDocument, type SenerRecord } from "@/lib/sener/types";
import { fetchSession, useSenerWorkspace, type SessionInfo } from "@/lib/sener/client";
import {
  ACCEPT_ATTR,
  ALL_PRODUCTS,
  G,
  downloadJson,
  errorMessage,
  fuelOptions,
  periodInfo,
  storageGet,
  storageSet,
} from "@/lib/sener/ui-helpers";
import { SenerContext, DEFAULT_FACTORS, type Factors, type SenerContextValue } from "./SenerContext";
import { useDrafts } from "./useDrafts";
import { useIntake } from "./useIntake";
import { useAttachOriginal } from "./useAttachOriginal";
import { parseBackup } from "./import-merge";
import type { ModalState, SaveRows, ViewerTarget } from "./sener-types";
import Toast from "./Toast";

const FUEL_KEY = "sener-fuel-filter";
const HORIZON_KEY = "sener-calculation-period";

export default function SenerProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ws = useSenerWorkspace();
  const workspace = ws.envelope?.workspace ?? EMPTY_WORKSPACE;
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [toastText, setToastText] = useState<{ text: string; n: number } | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [viewer, setViewer] = useState<ViewerTarget | null>(null);
  const [fuelPref, setFuelPref] = useState<string>(() => storageGet(FUEL_KEY) || ALL_PRODUCTS);
  const [horizon, setHorizonState] = useState<Horizon>(() => {
    const saved = storageGet(HORIZON_KEY);
    return saved && saved in HORIZONS ? (saved as Horizon) : "monthly";
  });
  const [factors, setFactors] = useState<Factors>(DEFAULT_FACTORS);
  const fileInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const toast = useCallback((text: string) => setToastText((t) => ({ text, n: (t?.n ?? 0) + 1 })), []);
  const drafts = useDrafts(toast);
  const openViewer = useCallback((t: ViewerTarget) => setViewer(t), []);
  const closeViewer = useCallback(() => setViewer(null), []);
  const goDocuments = useCallback(() => router.push("/sener/documents"), [router]);

  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  // A file dropped outside a drop target must not navigate away from the workspace.
  useEffect(() => {
    const guard = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", guard);
    window.addEventListener("drop", guard);
    return () => {
      window.removeEventListener("dragover", guard);
      window.removeEventListener("drop", guard);
    };
  }, []);

  const intake = useIntake({
    ws,
    workspace,
    email: session?.email ?? null,
    setModal,
    toast,
    goDocuments,
    openViewer,
    drafts,
  });

  // Defer remote replacement while any dialog, upload or review is open.
  const setWsBusy = ws.setBusy;
  useEffect(() => {
    setWsBusy(modal !== null || intake.uploadBusy || intake.extraction !== null);
  }, [setWsBusy, modal, intake.uploadBusy, intake.extraction]);

  const fuels = useMemo(() => fuelOptions(workspace.records), [workspace.records]);
  const fuel = fuelPref === ALL_PRODUCTS || fuels.includes(fuelPref) ? fuelPref : ALL_PRODUCTS;
  const setFuel = useCallback((f: string) => {
    setFuelPref(f);
    storageSet(FUEL_KEY, f);
  }, []);
  const setHorizon = useCallback((h: Horizon) => {
    setHorizonState(h);
    storageSet(HORIZON_KEY, h);
  }, []);
  const setFactor = useCallback((role: Role, value: number) => {
    setFactors((f) => ({ ...f, [role]: Math.min(3, Math.max(0, value)) }));
  }, []);
  const resetCalculator = useCallback(() => {
    setFactors(DEFAULT_FACTORS);
    toast("Calculator reset: all three sliders are at 100%. Your records and documents are unchanged.");
  }, [toast]);

  const today = currentUtcDate();
  const deferredFactors = useDeferredValue(factors);
  const calc = useMemo(() => {
    try {
      const opts = { fuel, horizon, today };
      return {
        base: calculate(workspace.records, opts),
        scenario: calculate(workspace.records, { ...opts, factors: deferredFactors }),
        error: null,
      };
    } catch (error) {
      return { base: null, scenario: null, error: errorMessage(error, "Calculation failed.") + " The displayed balance may be out of date." };
    }
  }, [workspace.records, fuel, horizon, today, deferredFactors]);

  const closeModal = useCallback(() => {
    const ex = intake.extractionRef.current;
    if (ex && !intake.busyRef.current) {
      intake.setExtraction(null);
      drafts.preserveExtraction(ex);
      setTimeout(intake.next, 150);
    }
    setModal(null);
  }, [intake, drafts]);

  const openRecord = useCallback((record: SenerRecord | null, onSave?: SaveRows) => {
    setModal(record?.role === "customer" ? { kind: "splits", record, onSave } : { kind: "record", record, onSave });
  }, []);

  const openUpload = useCallback(() => {
    if (intake.busyRef.current) toast("A document is already being analyzed.");
    else setModal({ kind: "upload" });
  }, [intake.busyRef, toast]);

  const pickFiles = useCallback(() => {
    if (intake.busyRef.current) toast("A document is already being analyzed.");
    else fileInput.current?.click();
  }, [intake.busyRef, toast]);

  const attach = useAttachOriginal({ ws, toast, openViewer });

  const scenario = calc.scenario;
  const exportJson = useCallback(() => {
    const payload = {
      ...workspace,
      unsavedDrafts: drafts.list,
      exportedAt: new Date().toISOString(),
      reportingPeriod: horizon,
      conversion: { litersPerUSGallon: G },
      scenario: { factors, ...(scenario ?? {}) },
    };
    downloadJson(`oiltex-sener-${today}.json`, payload);
    toast("JSON backup downloaded. Original file bytes are NOT included; download originals separately in LOI Documents.");
  }, [workspace, drafts.list, horizon, factors, scenario, today, toast]);

  const onImportFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        const incoming = await parseBackup(file);
        setModal({ kind: "import", incoming });
      } catch (error) {
        toast(errorMessage(error, "Invalid JSON backup. No records changed."));
      }
    },
    [toast],
  );

  const afterClear = useCallback(() => {
    intake.reset();
    setViewer(null);
    setFactors(DEFAULT_FACTORS);
    setFuel(ALL_PRODUCTS);
    setModal(null);
    router.push("/sener");
    toast("Shared records and document references cleared for everyone. Stored original bytes were not erased.");
  }, [intake, router, setFuel, toast]);

  const value: SenerContextValue = {
    ws,
    workspace,
    session,
    today,
    fuel,
    setFuel,
    fuels,
    horizon,
    setHorizon,
    period: periodInfo(horizon),
    factors,
    setFactor,
    resetCalculator,
    base: calc.base,
    scenario: calc.scenario,
    calcError: calc.error,
    modal,
    setModal,
    closeModal,
    openRecord,
    viewer,
    openViewer,
    closeViewer,
    toast,
    drafts,
    intake,
    openUpload,
    pickFiles,
    beginAttach: (doc: SenerDocument) => attach.begin(doc),
    exportJson,
    pickImport: () => jsonInput.current?.click(),
    afterClear,
  };

  return (
    <SenerContext.Provider value={value}>
      {children}
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) {
            setModal(null);
            intake.enqueue(files);
          }
        }}
      />
      <input
        ref={jsonInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onImportFile(file);
        }}
      />
      {attach.input}
      <Toast toast={toastText} />
    </SenerContext.Provider>
  );
}
