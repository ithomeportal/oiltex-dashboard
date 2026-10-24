// JSON backup parse + non-destructive merge (port of app.js importJSON and
// shared-workspace.js merge). Conflicts abort; exact duplicates are skipped.

import type { SenerDocument, SenerRecord, SenerWorkspace } from "@/lib/sener/types";
import { MAX_ITEMS } from "@/lib/sener/types";
import { candidateKey, validateDocumentIndex } from "@/lib/sener/ui-helpers";
import { checkRecords } from "./upload";

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export async function parseBackup(file: File): Promise<SenerWorkspace> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error("JSON backup is too large; maximum 20 MB.");
  let incoming: unknown;
  try {
    incoming = JSON.parse(await file.text());
  } catch {
    throw new Error("Invalid JSON backup. No records changed.");
  }
  const ws = incoming as Partial<SenerWorkspace> | null;
  if (
    !ws ||
    ws.version !== 1 ||
    !Array.isArray(ws.records) ||
    !Array.isArray(ws.documents) ||
    ws.documents.length > MAX_ITEMS
  ) {
    throw new Error("This is not a supported Oil Tex workspace backup.");
  }
  const docs = ws.documents as unknown[];
  const badDoc = docs.some((raw) => {
    const doc = raw as Partial<SenerDocument> | null;
    return (
      !doc ||
      typeof doc.id !== "string" ||
      typeof doc.name !== "string" ||
      (doc.text !== undefined && doc.text !== null && typeof doc.text !== "string") ||
      !Array.isArray(doc.warnings || [])
    );
  });
  if (badDoc) throw new Error("Invalid document metadata in backup.");
  const parsed: SenerWorkspace = { version: 1, records: ws.records, documents: ws.documents };
  validateDocumentIndex(parsed);
  checkRecords(parsed.records);
  return parsed;
}

function conflicting(a: SenerRecord, b: SenerRecord): boolean {
  return (
    candidateKey(a) !== candidateKey(b) ||
    (a.sourceId || "") !== (b.sourceId || "") ||
    (a.splitGroupId || "") !== (b.splitGroupId || "") ||
    a.status !== b.status ||
    (a.validFrom || "") !== (b.validFrom || "") ||
    (a.validUntil || "") !== (b.validUntil || "") ||
    (a.location || "") !== (b.location || "") ||
    (a.notes || "") !== (b.notes || "") ||
    (a.segment || "") !== (b.segment || "") ||
    (a.stations ?? null) !== (b.stations ?? null) ||
    (a.agreement || "Non-binding LOI") !== (b.agreement || "Non-binding LOI")
  );
}

export function mergeWorkspaces(current: SenerWorkspace, incoming: SenerWorkspace): SenerWorkspace {
  const documents: SenerDocument[] = current.documents.map((d) => ({ ...d }));
  const records: SenerRecord[] = current.records.map((r) => ({ ...r }));
  const sourceMap = new Map<string, string>();
  for (const doc of incoming.documents) {
    const matches = documents.filter(
      (e) =>
        e.id === doc.id || (doc.hash && e.hash === doc.hash) || (doc.fingerprint && e.fingerprint === doc.fingerprint),
    );
    if (matches.length > 1) {
      throw new Error("Ambiguous source identifiers match different shared documents. Merge stopped; no records were replaced.");
    }
    const match = matches[0];
    if (match) {
      const sameId = match.id === doc.id;
      const sameHash = Boolean(doc.hash && match.hash === doc.hash);
      const hashClash = sameId && match.hash && doc.hash && match.hash !== doc.hash;
      const printClash = (sameId || sameHash) && match.fingerprint && doc.fingerprint && match.fingerprint !== doc.fingerprint;
      if (hashClash || printClash) {
        throw new Error("Conflicting document identifiers. Keep a backup and resolve this source before merging.");
      }
      sourceMap.set(doc.id, match.id);
    } else {
      documents.push({ ...doc });
      sourceMap.set(doc.id, doc.id);
    }
  }
  for (const original of incoming.records) {
    const record: SenerRecord = {
      ...original,
      ...(original.sourceId ? { sourceId: sourceMap.get(original.sourceId) || original.sourceId } : {}),
    };
    const existing = records.find((r) => r.id === record.id);
    if (existing) {
      if (conflicting(existing, record)) {
        throw new Error("A record ID has conflicting values. Merge stopped; no existing records were replaced.");
      }
      continue;
    }
    if (record.sourceId && records.some((r) => r.sourceId === record.sourceId && candidateKey(r) === candidateKey(record))) {
      continue;
    }
    records.push(record);
  }
  const next: SenerWorkspace = { version: 1, records, documents };
  validateDocumentIndex(next);
  return next;
}
