"use client";

// Reattach an exact original (viewer.js attachOriginal): SHA-256 must match.

import { useCallback, useRef } from "react";
import type { SenerDocument } from "@/lib/sener/types";
import type { SenerWorkspaceApi } from "@/lib/sener/client";
import { ACCEPT_ATTR, MAX_UPLOAD_BYTES, errorMessage, sha256Hex } from "@/lib/sener/ui-helpers";
import { patchDoc } from "./intake-ops";
import { uploadOriginal } from "./upload";
import type { ViewerTarget } from "./sener-types";

interface Deps {
  ws: SenerWorkspaceApi;
  toast: (t: string) => void;
  openViewer: (t: ViewerTarget) => void;
}

export function useAttachOriginal({ ws, toast, openViewer }: Deps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<SenerDocument | null>(null);

  const begin = useCallback((doc: SenerDocument) => {
    targetRef.current = doc;
    inputRef.current?.click();
  }, []);

  const attach = useCallback(
    async (file: File, doc: SenerDocument) => {
      try {
        if (file.size > MAX_UPLOAD_BYTES) throw new Error("Original file exceeds the 15 MB limit.");
        if (!doc.hash) {
          throw new Error(
            "This reference has no original-file hash; it cannot be verified automatically. Upload a new reviewed letter instead.",
          );
        }
        const hash = await sha256Hex(file);
        if (hash !== doc.hash) {
          throw new Error(
            "This is not the same original file. Its SHA-256 differs from the registered letter. Select the exact original; no records were changed.",
          );
        }
        toast("Uploading the exact original…");
        await uploadOriginal(file, hash);
        await ws.mutate(
          patchDoc(doc.id, (current) =>
            current.originalAvailable && current.originalSize === file.size
              ? null
              : { originalAvailable: true, originalSize: file.size, originalMime: file.type || current.originalMime },
          ),
        );
        toast("Original shared. Existing volume records are unchanged.");
        openViewer({ name: doc.name, hash, docId: doc.id });
      } catch (error) {
        toast(errorMessage(error));
      }
    },
    [ws, toast, openViewer],
  );

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT_ATTR}
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        const doc = targetRef.current;
        targetRef.current = null;
        if (file && doc) void attach(file, doc);
      }}
    />
  );

  return { begin, input };
}
