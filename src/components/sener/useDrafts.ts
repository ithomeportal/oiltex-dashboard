"use client";

// Port of unsaved-drafts.js: failed saves keep a private localStorage draft.

import { useCallback, useState } from "react";
import { deepCopy, storageGet, storageSet } from "@/lib/sener/ui-helpers";
import type { Draft, Extraction } from "./sener-types";

const KEY = "sener-unsaved-drafts";

function readDrafts(): Draft[] {
  try {
    const parsed: unknown = JSON.parse(storageGet(KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as Draft[]) : [];
  } catch {
    return [];
  }
}

export interface DraftsApi {
  list: Draft[];
  preserve: (draft: Draft) => void;
  preserveExtraction: (extraction: Extraction) => void;
  remove: (kind: Draft["kind"], key: string) => void;
}

export function useDrafts(onStorageFail: (msg: string) => void): DraftsApi {
  const [list, setList] = useState<Draft[]>(() => (typeof window === "undefined" ? [] : readDrafts()));

  const preserve = useCallback(
    (draft: Draft) => {
      const serializable = deepCopy(draft);
      setList((current) => {
        const next = [...current.filter((d) => !(d.kind === draft.kind && d.key === draft.key)), serializable];
        if (!storageSet(KEY, JSON.stringify(next))) {
          onStorageFail("Draft kept in memory only. Export JSON before closing this page.");
        }
        return next;
      });
    },
    [onStorageFail],
  );

  const preserveExtraction = useCallback(
    (extraction: Extraction) => {
      const { original: _omit, ...value } = extraction;
      void _omit;
      preserve({ kind: "extraction", key: extraction.docId, value });
    },
    [preserve],
  );

  const remove = useCallback(
    (kind: Draft["kind"], key: string) => {
      setList((current) => {
        const next = current.filter((d) => !(d.kind === kind && d.key === key));
        storageSet(KEY, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  return { list, preserve, preserveExtraction, remove };
}
