"use client";

// SENER browser client — typed fetch wrappers for /api/sener/** and the
// shared-workspace hook (port of Manus shared-workspace.js: CAS save,
// bounded-retry mutate, revision polling that defers while a dialog is open).

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiResponse, SenerRecord, SenerWorkspace, WorkspaceEnvelope } from "./types";
import { deepCopy, errorMessage, validateDocumentIndex } from "./ui-helpers";

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface SessionInfo {
  authenticated: boolean;
  email: string | null;
  isAdmin: boolean;
  scope?: "internal" | "sener";
}

export interface HistoryEntry {
  revision: number;
  updatedAt: string;
  updatedBy: string | null;
  records: number | unknown[];
  documents: number | unknown[];
}

export interface StoredFileInfo {
  hash: string;
  name: string;
  mime: string;
  size: number;
}

export interface ExtractResult {
  records: SenerRecord[];
  warnings: string[];
  sourceText: string;
  fingerprint: string;
  hash: string;
  filename: string;
}

const POLL_MS = 10_000;
const MAX_CONFLICT_RETRIES = 4;

function linkSignals(timeoutMs: number, external?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  if (external?.aborted) controller.abort();
  external?.addEventListener("abort", onAbort, { once: true });
  const dispose = () => {
    clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
  };
  return { signal: controller.signal, dispose };
}

async function apiJson<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 30_000, signal: external, ...rest } = init;
  const { signal, dispose } = linkSignals(timeoutMs, external ?? undefined);
  try {
    const response = await fetch(path, {
      cache: "no-store",
      ...rest,
      headers: rest.body ? { "Content-Type": "application/json", ...(rest.headers || {}) } : rest.headers,
      signal,
    });
    let payload: ApiResponse<T> | null = null;
    try {
      payload = (await response.json()) as ApiResponse<T>;
    } catch {
      payload = null;
    }
    if (!response.ok || !payload || !payload.success) {
      throw new ApiError(payload?.error || `Request failed (${response.status}).`, response.status);
    }
    return payload.data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (external?.aborted) throw error;
      throw new ApiError("Request timed out. Retry; do not assume the change was saved.", 0);
    }
    throw error;
  } finally {
    dispose();
  }
}

// ---- endpoint wrappers --------------------------------------------------------

export const fetchWorkspace = () => apiJson<WorkspaceEnvelope>("/api/sener/workspace");

export const fetchRevision = () =>
  apiJson<{ revision: number; updatedAt: string }>("/api/sener/workspace/revision", { timeoutMs: 15_000 });

export const putWorkspace = (workspace: SenerWorkspace, revision: number) =>
  apiJson<WorkspaceEnvelope>("/api/sener/workspace", {
    method: "PUT",
    body: JSON.stringify({ workspace, revision }),
  });

export const fetchHistory = () => apiJson<HistoryEntry[]>("/api/sener/history");

export const registerFile = (hash: string, key: string, name: string, signal?: AbortSignal) =>
  apiJson<StoredFileInfo>(`/api/sener/files/${hash}`, {
    method: "POST",
    body: JSON.stringify({ key, name }),
    signal,
  });

export const extractDocument = (hash: string, signal?: AbortSignal) =>
  apiJson<ExtractResult>("/api/sener/extract", {
    method: "POST",
    body: JSON.stringify({ hash }),
    signal,
    timeoutMs: 240_000,
  });

export const fetchWordPreview = (hash: string, signal?: AbortSignal) =>
  apiJson<{ html: string }>(`/api/sener/preview/word/${hash}`, { signal, timeoutMs: 110_000 });

export function fileUrl(hash: string, download = false): string {
  return `/api/sener/files/${hash}${download ? "?download=1" : ""}`;
}

/** Fetch the shared original; null when the server has no copy (404). */
export async function fetchOriginal(hash: string, signal?: AbortSignal): Promise<Blob | null> {
  const response = await fetch(fileUrl(hash), { cache: "no-store", signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Shared original could not be downloaded. Retry; your records are unchanged.");
  return response.blob();
}

export async function fetchSession(): Promise<SessionInfo> {
  const response = await fetch("/api/auth/session", { cache: "no-store" });
  const data = (await response.json()) as Partial<SessionInfo>;
  return {
    authenticated: Boolean(data.authenticated),
    email: data.email ?? null,
    isAdmin: Boolean(data.isAdmin),
    scope: data.scope,
  };
}

// ---- shared workspace hook --------------------------------------------------

export type SyncTone = "ok" | "busy" | "error";
export interface SyncStatus {
  text: string;
  tone: SyncTone;
}

const SYNCED: SyncStatus = { text: "Shared workspace · synced", tone: "ok" };
const SAVED: SyncStatus = { text: "Shared workspace · saved for everyone", tone: "ok" };
const SAVING: SyncStatus = { text: "Saving shared changes…", tone: "busy" };
const FAILED: SyncStatus = { text: "Save failed · changes NOT shared", tone: "error" };

export type Mutator = (workspace: SenerWorkspace) => SenerWorkspace | null | undefined;

export interface SenerWorkspaceApi {
  envelope: WorkspaceEnvelope | null;
  loadError: string | null;
  status: SyncStatus;
  save: (next: SenerWorkspace) => Promise<SenerWorkspace>;
  mutate: (fn: Mutator) => Promise<{ workspace: SenerWorkspace; revision: number }>;
  refresh: () => Promise<void>;
  setBusy: (busy: boolean) => void;
}

function assertWorkspace(ws: SenerWorkspace | null | undefined): asserts ws is SenerWorkspace {
  if (!ws || ws.version !== 1 || !Array.isArray(ws.records) || !Array.isArray(ws.documents)) {
    throw new Error("Shared mutations must return a complete version 1 workspace.");
  }
}

export function useSenerWorkspace(): SenerWorkspaceApi {
  const [envelope, setEnvelope] = useState<WorkspaceEnvelope | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>({ text: "Shared workspace · connecting…", tone: "busy" });
  const revisionRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const pollingRef = useRef(false);
  const busyRef = useRef(false);
  const pendingRemoteRef = useRef(false);
  const lastErrorRef = useRef("");

  const apply = useCallback((env: WorkspaceEnvelope) => {
    revisionRef.current = env.revision;
    setEnvelope(env);
  }, []);

  const load = useCallback(async () => {
    try {
      const env = await fetchWorkspace();
      apply(env);
      setLoadError(null);
      setStatus(SYNCED);
    } catch (error) {
      setLoadError(errorMessage(error, "Shared workspace could not load."));
      setStatus({ text: "Shared workspace unavailable", tone: "error" });
    }
  }, [apply]);

  const poll = useCallback(
    async (force = false) => {
      if (revisionRef.current === null) {
        if (force) await load();
        return;
      }
      if (savingRef.current || pollingRef.current) return;
      if (!force && typeof document !== "undefined" && document.hidden) return;
      pollingRef.current = true;
      const starting = revisionRef.current;
      try {
        const { revision } = await fetchRevision();
        // A save can finish while this GET is in flight. Never apply an older snapshot.
        if (savingRef.current || revisionRef.current !== starting) return;
        if (revision === starting) {
          if (!lastErrorRef.current) setStatus(SYNCED);
          return;
        }
        if (busyRef.current) {
          pendingRemoteRef.current = true;
          setStatus({ text: "New shared changes · finish this dialog first", tone: "busy" });
          return;
        }
        const env = await fetchWorkspace();
        if (savingRef.current || revisionRef.current !== starting) return;
        if (busyRef.current) {
          pendingRemoteRef.current = true;
          setStatus({ text: "New shared changes · finish this dialog first", tone: "busy" });
          return;
        }
        pendingRemoteRef.current = false;
        lastErrorRef.current = "";
        apply(env);
        setStatus(SYNCED);
      } catch {
        setStatus({ text: "Sync unavailable · retrying", tone: "error" });
      } finally {
        pollingRef.current = false;
      }
    },
    [apply, load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (!document.hidden) void poll(true);
    };
    const onForce = () => void poll(true);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onForce);
    window.addEventListener("online", onForce);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onForce);
      window.removeEventListener("online", onForce);
    };
  }, [poll]);

  const setBusy = useCallback(
    (busy: boolean) => {
      busyRef.current = busy;
      if (!busy && pendingRemoteRef.current) setTimeout(() => void poll(true), 100);
    },
    [poll],
  );

  // Callers build `next` from the workspace they RENDERED, so the CAS must use
  // that snapshot's revision — not revisionRef, which a background mutate() or
  // poll may already have advanced. Otherwise a stale edit would pass the
  // revision check and silently drop the newer change (caught in review).
  const renderedRevision = envelope?.revision ?? null;
  const save = useCallback(
    async (next: SenerWorkspace) => {
      if (savingRef.current) throw new Error("Another save is in progress. Please wait and retry.");
      if (renderedRevision === null) throw new Error("Shared workspace has not loaded. Reload before saving.");
      savingRef.current = true;
      setStatus(SAVING);
      try {
        validateDocumentIndex(next);
        const env = await putWorkspace(next, renderedRevision);
        lastErrorRef.current = "";
        pendingRemoteRef.current = false;
        apply(env);
        setStatus(SAVED);
        return env.workspace;
      } catch (error) {
        lastErrorRef.current = errorMessage(error);
        setStatus(FAILED);
        throw error;
      } finally {
        savingRef.current = false;
      }
    },
    [apply, renderedRevision],
  );

  const mutate = useCallback(
    async (fn: Mutator) => {
      if (savingRef.current) throw new Error("Another save is in progress. Please wait and retry.");
      if (revisionRef.current === null) throw new Error("Shared workspace has not loaded. Reload before saving.");
      savingRef.current = true;
      setStatus(SAVING);
      try {
        let conflicts = 0;
        for (;;) {
          const latest = await fetchWorkspace();
          // The callback receives a private copy; it can never touch the snapshot used for retries.
          const next = fn(deepCopy(latest.workspace));
          if (next == null || JSON.stringify(next) === JSON.stringify(latest.workspace)) {
            apply(latest);
            lastErrorRef.current = "";
            setStatus(SYNCED);
            return { workspace: deepCopy(latest.workspace), revision: latest.revision };
          }
          assertWorkspace(next);
          validateDocumentIndex(next);
          try {
            const env = await putWorkspace(next, latest.revision);
            apply(env);
            lastErrorRef.current = "";
            pendingRemoteRef.current = false;
            setStatus(SAVED);
            return { workspace: deepCopy(env.workspace), revision: env.revision };
          } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 409 || conflicts >= MAX_CONFLICT_RETRIES) throw error;
            conflicts++;
          }
        }
      } catch (error) {
        lastErrorRef.current = errorMessage(error);
        setStatus(FAILED);
        throw error;
      } finally {
        savingRef.current = false;
      }
    },
    [apply],
  );

  const refresh = useCallback(() => poll(true), [poll]);

  return { envelope, loadError, status, save, mutate, refresh, setBusy };
}
