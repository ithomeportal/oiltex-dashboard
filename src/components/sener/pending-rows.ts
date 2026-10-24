// Derived "pending customer LOI" register rows (port of customer-register.js pendingRows).

import type { SenerWorkspace } from "@/lib/sener/types";
import type { RegisterEntry } from "@/lib/sener/ui-helpers";

/** customer-register.js pendingRows: purchase LOIs with no registered lines. */
export function pendingCustomerRows(ws: SenerWorkspace): RegisterEntry[] {
  return ws.documents
    .filter(
      (doc) =>
        !ws.records.some((r) => r.sourceId === doc.id) &&
        doc.reviewStatus !== "duplicate" &&
        ((doc.proposedRecords || []).some((r) => r.role === "customer") ||
          /compra\s+de\s+productos\s+refinados|\bcomprador[.\s:]/i.test(doc.text || "")),
    )
    .map((doc) => {
      const text = (doc.text || "").replace(/\s+/g, " ");
      const fromProposals = [
        ...new Set((doc.proposedRecords || []).filter((r) => r.role === "customer").map((r) => r.company).filter(Boolean)),
      ].join(" · ");
      const fromText = text.match(/raz[oó]n\s+social\s*[:.]?\s*(.+?)\s+(?:sociedad\b|RFC\b|Domicilio\b)/i)?.[1]?.trim();
      return {
        id: "pending:" + doc.id,
        company: fromProposals || fromText || "Customer LOI: " + doc.name,
        role: "customer" as const,
        fuels: [],
        quantity: null,
        unit: "unknown" as const,
        period: "unknown" as const,
        status: "draft" as const,
        agreement: "Non-binding LOI" as const,
        location: "Source: " + doc.name,
        segment: "Needs volume review" as unknown as "Other",
        sourceId: doc.id,
        pendingDocument: true,
      };
    });
}
