import type { SenerRecord, SenerWorkspace } from "@/lib/sener/types";

/** An in-progress LOI review (Manus `extraction`). Accepted proposals are tracked by id. */
export interface Extraction {
  docId: string;
  filename: string;
  hash?: string;
  fingerprint?: string;
  sourceText: string;
  warnings: string[];
  records: SenerRecord[];
  accepted: string[];
  original: File | null;
  draftKey?: string;
}

export type SaveRows = (rows: SenerRecord[]) => void;

export type ModalState =
  | { kind: "upload" }
  | { kind: "progress"; filename: string; message: string; onCancel: () => void }
  | {
      kind: "failure";
      title: string;
      subtitle: string;
      message: string;
      detail: string;
      onRetry: () => void;
      manualRecord: SenerRecord | null;
    }
  | { kind: "record"; record: SenerRecord | null; onSave?: SaveRows }
  | { kind: "splits"; record: SenerRecord | null; onSave?: SaveRows; draftRows?: SenerRecord[]; draftKey?: string }
  | { kind: "review"; error?: string }
  | { kind: "source"; docId: string }
  | { kind: "removeDoc"; docId: string }
  | { kind: "info" }
  | { kind: "clear" }
  | { kind: "import"; incoming: SenerWorkspace }
  | { kind: "drafts" };

export interface ViewerTarget {
  name: string;
  hash?: string;
  docId?: string;
  file?: File | null;
}

export interface SplitsDraftValue {
  docId: string;
  company: string;
  records: SenerRecord[];
  wasEditing: boolean;
  baseRecordId: string;
  originalIds: string[];
  originalIdentity: { groupId: string; company: string; sourceId: string; role: string };
}

export type ExtractionDraftValue = Omit<Extraction, "original">;

export type Draft =
  | { kind: "record"; key: string; value: SenerRecord }
  | { kind: "customer-splits"; key: string; value: SplitsDraftValue }
  | { kind: "extraction"; key: string; value: ExtractionDraftValue };
