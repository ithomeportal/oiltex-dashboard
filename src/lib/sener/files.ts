import { createHash } from "crypto";
import { UTApi } from "uploadthing/server";
import pool from "@/lib/db";
import { MAX_FILE_BYTES } from "./types";

// SENER originals (LOI PDFs/Word/images) — content-addressed by SHA-256.
//
// Bytes live in UploadThing; `sener_files` maps hash → UploadThing key, and
// bytes are always read through a short-lived signed URL. No storage URL is
// ever sent to the browser: originals are confidential commercial letters, so
// they are only served through the session-checked route
// /api/sener/files/[hash].

export const HASH_RE = /^[a-f0-9]{64}$/;

const ALLOWED: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export class FileRejected extends Error {
  constructor(message: string, readonly status: 413 | 422 = 422) {
    super(message);
    this.name = "FileRejected";
  }
}

export interface IndexedFile {
  hash: string;
  key: string;
  name: string;
  mime: string;
  size: number;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

export function mimeFor(name: string): string | null {
  return ALLOWED[extensionOf(name)] ?? null;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

/** Magic-byte check so a renamed executable can't pose as a letter. */
export function assertSignature(bytes: Uint8Array, name: string): string {
  const mime = mimeFor(name);
  if (!mime) throw new FileRejected("Supported files: PDF, DOCX, TXT, MD, PNG, JPG or WEBP.");
  if (bytes.length === 0) throw new FileRejected("The file is empty.");
  if (bytes.length > MAX_FILE_BYTES) throw new FileRejected("Maximum file size is 15 MB.", 413);
  const ext = extensionOf(name);
  const ok =
    (ext === ".pdf" && startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) || // %PDF-
    (ext === ".docx" && startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) || // zip
    (ext === ".png" && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) ||
    ((ext === ".jpg" || ext === ".jpeg") && startsWith(bytes, [0xff, 0xd8, 0xff])) ||
    (ext === ".webp" && startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) ||
    ext === ".txt" ||
    ext === ".md";
  if (!ok) throw new FileRejected(`File contents do not match the ${ext} extension.`);
  return mime;
}

interface FileRow {
  file_hash: string;
  file_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: string;
}

function toIndexed(row: FileRow): IndexedFile {
  return {
    hash: row.file_hash,
    key: row.file_key,
    name: row.original_name,
    mime: row.mime_type,
    size: Number(row.size_bytes),
  };
}

export async function findFile(hash: string): Promise<IndexedFile | null> {
  const { rows } = await pool.query<FileRow>(
    `SELECT file_hash, file_key, original_name, mime_type, size_bytes
       FROM sener_files WHERE file_hash = $1`,
    [hash]
  );
  return rows[0] ? toIndexed(rows[0]) : null;
}

/** Insert once; an existing hash wins (first upload is authoritative). */
export async function indexFile(file: IndexedFile, uploadedBy: string): Promise<IndexedFile> {
  await pool.query(
    `INSERT INTO sener_files (file_hash, file_key, original_name, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (file_hash) DO NOTHING`,
    [file.hash, file.key, file.name, file.mime, file.size, uploadedBy]
  );
  const stored = await findFile(file.hash);
  if (!stored) throw new Error("File index write did not persist");
  return stored;
}

/** Read an UploadThing object by key via a 5-minute signed URL. */
export async function readStoredBytes(key: string): Promise<Uint8Array> {
  const { ufsUrl } = await new UTApi().generateSignedURL(key, { expiresIn: 300 });
  const res = await fetch(ufsUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Storage fetch failed: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_FILE_BYTES) throw new FileRejected("Maximum file size is 15 MB.", 413);
  return bytes;
}

/** Record a senerUploader upload (called from UploadThing's onUploadComplete). */
export async function recordPendingUpload(key: string, uploadedBy: string): Promise<void> {
  await pool.query(
    `INSERT INTO sener_uploads (file_key, uploaded_by) VALUES ($1, $2) ON CONFLICT (file_key) DO NOTHING`,
    [key, uploadedBy]
  );
}

/** True only if `key` came from senerUploader for this same user. */
export async function ownsPendingUpload(key: string, email: string): Promise<boolean> {
  const { rows } = await pool.query<{ uploaded_by: string }>(
    `SELECT uploaded_by FROM sener_uploads WHERE file_key = $1`,
    [key]
  );
  return rows[0]?.uploaded_by === email;
}

export async function clearPendingUpload(key: string): Promise<void> {
  await pool.query(`DELETE FROM sener_uploads WHERE file_key = $1`, [key]);
}

/** Only ever call with a key that passed ownsPendingUpload(). */
export async function deleteUploadThingFile(key: string): Promise<void> {
  try {
    await new UTApi().deleteFiles(key);
  } catch (error) {
    console.error("sener: failed to delete redundant UploadThing file", error);
  }
}
