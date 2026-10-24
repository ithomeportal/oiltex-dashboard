"use client";

import { createContext, useContext } from "react";
import type { CalculationResult, Horizon, Role, SenerDocument, SenerRecord, SenerWorkspace } from "@/lib/sener/types";
import type { SenerWorkspaceApi, SessionInfo } from "@/lib/sener/client";
import type { IntakeApi } from "./useIntake";
import type { DraftsApi } from "./useDrafts";
import type { ModalState, SaveRows, ViewerTarget } from "./sener-types";

export type Factors = Record<Role, number>;
export const DEFAULT_FACTORS: Factors = { supplier: 1, transport: 1, customer: 1 };

export interface SenerContextValue {
  ws: SenerWorkspaceApi;
  workspace: SenerWorkspace;
  session: SessionInfo | null;
  today: string;
  fuel: string;
  setFuel: (fuel: string) => void;
  fuels: string[];
  horizon: Horizon;
  setHorizon: (h: Horizon) => void;
  period: { label: string; months: number; unit: string };
  factors: Factors;
  setFactor: (role: Role, value: number) => void;
  resetCalculator: () => void;
  base: CalculationResult | null;
  scenario: CalculationResult | null;
  calcError: string | null;
  modal: ModalState | null;
  setModal: (m: ModalState | null) => void;
  closeModal: () => void;
  openRecord: (record: SenerRecord | null, onSave?: SaveRows) => void;
  viewer: ViewerTarget | null;
  openViewer: (t: ViewerTarget) => void;
  closeViewer: () => void;
  toast: (text: string) => void;
  drafts: DraftsApi;
  intake: IntakeApi;
  openUpload: () => void;
  pickFiles: () => void;
  beginAttach: (doc: SenerDocument) => void;
  exportJson: () => void;
  pickImport: () => void;
  afterClear: () => void;
}

export const SenerContext = createContext<SenerContextValue | null>(null);

export function useSener(): SenerContextValue {
  const ctx = useContext(SenerContext);
  if (!ctx) throw new Error("useSener must be used inside <SenerProvider>.");
  return ctx;
}
