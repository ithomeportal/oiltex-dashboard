// One-time migration: Manus "Oil Tex Permit Match" → SENER workspace in defaultdb.
//
//   npx -y tsx --env-file=.env.local scripts/sener-import.ts [--dry-run] [--originals <dir>]
//
// 1. Reads the LIVE Manus workspace (the 2026-10-20 handoff ZIP is a snapshot
//    and was already 2 LOIs behind on 2026-10-24).
// 2. Downloads every referenced original from Manus, verifies its SHA-256; if
//    the download fails, falls back to <dir>/<sha256>/<file> from the ZIP.
// 3. Uploads originals to UploadThing and indexes them in sener_files.
// 4. Validates the workspace with the app's own validator and inserts it as
//    `main`, keeping the Manus revision number. Refuses if `main` already exists.
// Only the `main` workspace is migrated — never Manus `verification-*` rows.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { UTApi, UTFile } from "uploadthing/server";
import { validateWorkspace } from "../src/lib/sener/validate";
import type { SenerWorkspace } from "../src/lib/sener/types";

const MANUS = "https://oiltex-btc9kbzr.manus.space";
const MIGRATED_BY = "migration:manus";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const originalsDir = args.includes("--originals") ? args[args.indexOf("--originals") + 1] : null;

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

async function fetchLive(): Promise<{ workspace: SenerWorkspace; revision: number }> {
  const res = await fetch(`${MANUS}/api/workspace`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Manus workspace HTTP ${res.status}`);
  const body = (await res.json()) as { workspace: SenerWorkspace; revision: number };
  return { workspace: body.workspace, revision: body.revision };
}

async function originalBytes(hash: string): Promise<{ bytes: Uint8Array; source: string }> {
  try {
    const res = await fetch(`${MANUS}/api/files/${hash}`, { cache: "no-store" });
    if (res.ok) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (sha256(bytes) === hash) return { bytes, source: "manus" };
      console.warn(`  ! ${hash.slice(0, 10)} Manus bytes failed SHA-256 check`);
    } else {
      console.warn(`  ! ${hash.slice(0, 10)} Manus HTTP ${res.status}`);
    }
  } catch (error) {
    console.warn(`  ! ${hash.slice(0, 10)} Manus fetch error: ${(error as Error).message}`);
  }
  const dir = originalsDir ? join(originalsDir, hash) : "";
  if (dir && existsSync(dir)) {
    const [name] = readdirSync(dir);
    const bytes = new Uint8Array(readFileSync(join(dir, name)));
    if (sha256(bytes) === hash) return { bytes, source: "handoff-zip" };
  }
  throw new Error(`original ${hash} unavailable from Manus and the handoff ZIP`);
}

async function main() {
  const { workspace: raw, revision } = await fetchLive();
  const workspace = validateWorkspace(raw);
  console.log(`Manus revision ${revision}: ${workspace.records.length} records, ${workspace.documents.length} documents`);

  const db = new pg.Client({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 10261),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  try {
    const existing = await db.query("SELECT revision FROM sener_workspaces WHERE workspace_id = 'main'");
    if (existing.rowCount && !dryRun) {
      throw new Error(`main already exists at revision ${existing.rows[0].revision}; refusing to overwrite`);
    }

    const utapi = new UTApi();
    for (const doc of workspace.documents.filter((d) => d.hash)) {
      const hash = doc.hash as string;
      const indexed = await db.query("SELECT 1 FROM sener_files WHERE file_hash = $1", [hash]);
      if (indexed.rowCount) {
        console.log(`  = ${doc.name} already indexed`);
        continue;
      }
      const { bytes, source } = await originalBytes(hash);
      const mime = doc.originalMime || "application/octet-stream";
      console.log(`  + ${doc.name} (${bytes.length} B, ${source})`);
      if (dryRun) continue;
      const uploaded = await utapi.uploadFiles(new UTFile([Buffer.from(bytes)], doc.name, { type: mime }));
      if (uploaded.error || !uploaded.data) throw new Error(`upload failed for ${doc.name}: ${uploaded.error?.message}`);
      await db.query(
        `INSERT INTO sener_files (file_hash, file_key, original_name, mime_type, size_bytes, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (file_hash) DO NOTHING`,
        [hash, uploaded.data.key, doc.name, mime, bytes.length, MIGRATED_BY]
      );
    }

    if (dryRun) {
      console.log("dry run — workspace not written");
      return;
    }
    const json = JSON.stringify(workspace);
    await db.query("BEGIN");
    await db.query(
      `INSERT INTO sener_workspaces (workspace_id, workspace_json, revision, updated_by)
       VALUES ('main', $1::jsonb, $2, $3)`,
      [json, revision, MIGRATED_BY]
    );
    await db.query(
      `INSERT INTO sener_workspace_history (workspace_id, revision, workspace_json, updated_by)
       VALUES ('main', $1, $2::jsonb, $3)`,
      [revision, json, MIGRATED_BY]
    );
    await db.query("COMMIT");
    console.log(`imported main at revision ${revision}`);
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("import failed:", error.message);
  process.exitCode = 1;
});
