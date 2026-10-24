import pool from "@/lib/db";
import { EMPTY_WORKSPACE, type SenerWorkspace, type WorkspaceEnvelope } from "./types";

// Shared SENER workspace — one JSON document per workspace_id, guarded by an
// optimistic revision (ported from Manus shared_store.py). Writers send the
// revision they read; a mismatch is a RevisionConflict and NOTHING is written,
// so two editors can never silently overwrite each other.
//
// Tables are created once by a privileged role (see docs/SPEC-SENER.md): the
// runtime role oiltex_rw has no CREATE on the shared `defaultdb`, so this
// module never runs DDL.

export const MAIN_WORKSPACE = "main";
const HISTORY_LIMIT = 50;

export class RevisionConflict extends Error {
  constructor(readonly currentRevision: number) {
    super(
      "Shared data changed after this page loaded, so your save was NOT applied. " +
        `Refresh shared data, reopen and reapply your change. Current revision is ${currentRevision}.`
    );
    this.name = "RevisionConflict";
  }
}

interface WorkspaceRow {
  workspace_json: SenerWorkspace;
  revision: string; // bigint arrives as string
  updated_at: Date;
  updated_by: string | null;
}

function toEnvelope(row: WorkspaceRow): WorkspaceEnvelope {
  return {
    workspace: row.workspace_json,
    revision: Number(row.revision),
    updatedAt: new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by,
  };
}

export async function readWorkspace(id = MAIN_WORKSPACE): Promise<WorkspaceEnvelope> {
  const { rows } = await pool.query<WorkspaceRow>(
    `SELECT workspace_json, revision, updated_at, updated_by
       FROM sener_workspaces WHERE workspace_id = $1`,
    [id]
  );
  if (rows[0]) return toEnvelope(rows[0]);
  return { workspace: EMPTY_WORKSPACE, revision: 0, updatedAt: new Date(0).toISOString(), updatedBy: null };
}

export async function readRevision(id = MAIN_WORKSPACE): Promise<{ revision: number; updatedAt: string }> {
  const { rows } = await pool.query<{ revision: string; updated_at: Date }>(
    `SELECT revision, updated_at FROM sener_workspaces WHERE workspace_id = $1`,
    [id]
  );
  return rows[0]
    ? { revision: Number(rows[0].revision), updatedAt: new Date(rows[0].updated_at).toISOString() }
    : { revision: 0, updatedAt: new Date(0).toISOString() };
}

/** Compare-and-swap write. Caller must have validated `workspace`. */
export async function replaceWorkspace(
  workspace: SenerWorkspace,
  expectedRevision: number,
  updatedBy: string,
  id = MAIN_WORKSPACE
): Promise<WorkspaceEnvelope> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Make sure a row exists to lock: FOR UPDATE on a missing row locks nothing,
    // which would let two first writers both pass the revision-0 check.
    await client.query(
      `INSERT INTO sener_workspaces (workspace_id, workspace_json, revision)
       VALUES ($1, $2::jsonb, 0) ON CONFLICT (workspace_id) DO NOTHING`,
      [id, JSON.stringify(EMPTY_WORKSPACE)]
    );
    const current = await client.query<{ revision: string }>(
      `SELECT revision FROM sener_workspaces WHERE workspace_id = $1 FOR UPDATE`,
      [id]
    );
    const currentRevision = current.rows[0] ? Number(current.rows[0].revision) : 0;
    if (currentRevision !== expectedRevision) {
      await client.query("ROLLBACK");
      throw new RevisionConflict(currentRevision);
    }
    const json = JSON.stringify(workspace);
    const { rows } = await client.query<WorkspaceRow>(
      `INSERT INTO sener_workspaces (workspace_id, workspace_json, revision, updated_at, updated_by)
       VALUES ($1, $2::jsonb, $3, NOW(), $4)
       ON CONFLICT (workspace_id) DO UPDATE
         SET workspace_json = EXCLUDED.workspace_json, revision = EXCLUDED.revision,
             updated_at = NOW(), updated_by = EXCLUDED.updated_by
       RETURNING workspace_json, revision, updated_at, updated_by`,
      [id, json, currentRevision + 1, updatedBy]
    );
    await client.query(
      `INSERT INTO sener_workspace_history (workspace_id, revision, workspace_json, updated_by)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [id, currentRevision + 1, json, updatedBy]
    );
    await client.query("COMMIT");
    return toEnvelope(rows[0]);
  } catch (error) {
    if (!(error instanceof RevisionConflict)) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export interface HistoryEntry {
  revision: number;
  updatedAt: string;
  updatedBy: string | null;
  records: number;
  documents: number;
}

export async function readHistory(id = MAIN_WORKSPACE): Promise<HistoryEntry[]> {
  const { rows } = await pool.query<{
    revision: string;
    created_at: Date;
    updated_by: string | null;
    records: number;
    documents: number;
  }>(
    `SELECT revision, created_at, updated_by,
            jsonb_array_length(workspace_json->'records') AS records,
            jsonb_array_length(workspace_json->'documents') AS documents
       FROM sener_workspace_history
      WHERE workspace_id = $1
      ORDER BY revision DESC
      LIMIT $2`,
    [id, HISTORY_LIMIT]
  );
  return rows.map((r) => ({
    revision: Number(r.revision),
    updatedAt: new Date(r.created_at).toISOString(),
    updatedBy: r.updated_by,
    records: r.records,
    documents: r.documents,
  }));
}

/** Hashes of originals referenced by the live workspace — only these are served. */
export function referencedHashes(workspace: SenerWorkspace): Set<string> {
  return new Set(workspace.documents.map((d) => d.hash).filter((h): h is string => Boolean(h)));
}
