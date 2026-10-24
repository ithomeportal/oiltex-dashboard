"use client";

import { G, ROLE_LABEL, monogram, num, type RegisterEntry } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { BTN_OUTLINE, BTN_RED_ORIGINAL, Icon, TD } from "./ui";

const ROLE_BADGE = {
  supplier: "bg-blue-100 text-blue-700",
  transport: "bg-purple-100 text-purple-700",
  customer: "bg-green-100 text-green-700",
} as const;

interface Props {
  record: RegisterEntry;
  index: number;
  liters: number;
  included: boolean;
  status: string;
}

export default function RegisterRow({ record: r, index, liters, included, status }: Props) {
  const { workspace, openViewer, openRecord, intake, toast } = useSener();
  const doc = r.sourceId ? workspace.documents.find((d) => d.id === r.sourceId) : undefined;
  const badge = ROLE_BADGE[r.role] ?? "bg-slate-100 text-slate-600";

  return (
    <tr>
      <td className={TD}>
        <div className="flex items-start gap-3">
          <span className="text-xs text-slate-400 w-6 pt-2" aria-label={`Row ${index + 1}`}>
            {index + 1}.
          </span>
          <span className="w-9 h-9 shrink-0 rounded-lg bg-slate-800 text-white text-xs font-semibold flex items-center justify-center">
            {monogram(r.company)}
          </span>
          <div className="min-w-0">
            <div className="font-medium text-slate-800">{r.company}</div>
            <div className="text-xs text-slate-500">{r.location || "Location not recorded"}</div>
            {r.role === "customer" && (
              <span className="inline-block mt-1 text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {r.segment || "Other"}
                {r.segment === "Station network" && r.stations ? ` · ${num(r.stations)} stations` : ""}
              </span>
            )}
          </div>
        </div>
      </td>
      <td className={TD}>
        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>{ROLE_LABEL[r.role] ?? r.role}</span>
        <div className="text-xs text-slate-600 mt-1">{r.fuels.join(" · ") || "Awaiting volume review"}</div>
      </td>
      <td className={TD}>
        <div className="font-medium text-slate-800">{r.pendingDocument ? "Not registered" : `${num(liters)} L`}</div>
        <div className="text-xs text-slate-500">{r.pendingDocument ? "Not counted in demand" : `${num(liters / G)} US gal`}</div>
        {!included && !r.pendingDocument && (
          <div className="text-xs text-slate-400 mt-1">
            Stated: {r.quantity === null ? "unknown" : num(r.quantity)} {r.unit} / {r.period}
          </div>
        )}
      </td>
      <td className={TD}>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            r.agreement === "Contract" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {r.agreement || "Non-binding LOI"}
        </span>
      </td>
      <td className={TD}>
        <span className={`inline-flex items-center gap-1.5 text-xs ${included ? "text-green-700" : "text-slate-500"}`}>
          <i className={`w-2 h-2 rounded-full inline-block ${included ? "bg-green-500" : "bg-slate-300"}`} />
          {status}
        </span>
      </td>
      <td className={TD}>
        {doc ? (
          <button
            type="button"
            className={BTN_RED_ORIGINAL}
            title={doc.name}
            aria-label={`View original LOI for ${r.company}`}
            onClick={() => {
              const current = workspace.documents.find((d) => d.id === doc.id);
              if (current) openViewer({ name: current.name, hash: current.hash, docId: current.id });
              else toast("This document is no longer linked. Refresh the shared register.");
            }}
          >
            View original
          </button>
        ) : (
          <span className="text-xs text-slate-400">No linked document</span>
        )}
      </td>
      <td className={`${TD} text-right`}>
        {r.pendingDocument ? (
          <button
            type="button"
            className={`${BTN_OUTLINE} !px-3 !py-1.5 text-xs whitespace-nowrap`}
            onClick={() => r.sourceId && void intake.reviewPendingCustomer(r.sourceId)}
          >
            Review LOI
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Edit ${r.company}`}
            className="text-slate-500 hover:text-blue-600 p-1.5"
            onClick={() => openRecord(workspace.records.find((x) => x.id === r.id) ?? r)}
          >
            <Icon name="edit" />
          </button>
        )}
      </td>
    </tr>
  );
}
