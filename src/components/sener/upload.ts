"use client";

import { uploadFiles } from "@/lib/uploadthing-client";
import { registerFile, type StoredFileInfo } from "@/lib/sener/client";
import { validateRecord } from "@/lib/sener/validate";
import type { SenerRecord } from "@/lib/sener/types";

const UPLOAD_TIMEOUT_MS = 180_000;

/** Upload original bytes to UploadThing, then index them server-side by SHA-256. */
export async function uploadOriginal(file: File, hash: string, external?: AbortSignal): Promise<StoredFileInfo> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  external?.addEventListener("abort", onAbort, { once: true });
  if (external?.aborted) controller.abort();
  try {
    const uploaded = await uploadFiles("senerUploader", { files: [file], signal: controller.signal });
    const key = uploaded?.[0]?.key;
    if (!key) throw new Error("Original upload failed. Retry before registering.");
    return await registerFile(hash, key, file.name, controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        "Original upload cancelled or timed out. Its shared entry may remain pending; retry/reattach the original.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
  }
}

/** Client-side pre-check with the shared validator (replaces Manus POST /api/calculate). */
export function checkRecords(records: readonly SenerRecord[]): void {
  for (const record of records) validateRecord(record);
}
