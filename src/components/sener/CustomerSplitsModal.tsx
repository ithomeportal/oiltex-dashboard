"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { Agreement, Period, RecordStatus, SenerRecord, Segment } from "@/lib/sener/types";
import {
  EXACT_OTHER_RE,
  G,
  errorMessage,
  fuelOptions,
  groupRows,
  newId,
  num,
  parseQuantity,
  replaceRows,
  splitIdentity,
} from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { checkRecords } from "./upload";
import SplitBoxes, { type SplitLine } from "./SplitBoxes";
import type { SaveRows } from "./sener-types";
import { BTN_DANGER, BTN_OUTLINE, BTN_PRIMARY, INPUT, LABEL, Modal, Notice, RefBox } from "./ui";

const MAX_SPLITS = 30;

function blankCustomer(): SenerRecord {
  return {
    id: newId(),
    company: "",
    role: "customer",
    fuels: ["Gasoline"],
    quantity: null,
    unit: "L",
    period: "monthly",
    status: "active",
    agreement: "Non-binding LOI",
    segment: "Private fleet",
    location: "",
    notes: "",
  };
}

interface Props {
  record: SenerRecord | null;
  onSave?: SaveRows;
  draftRows?: SenerRecord[];
  draftKey?: string;
}

/** customer-splits.js: one box per fuel; save replaces the original line / split group. */
export default function CustomerSplitsModal({ record, onSave, draftRows, draftKey }: Props) {
  const { workspace, ws, closeModal, setModal, intake, drafts, toast } = useSener();
  const [r] = useState<SenerRecord>(() => record ?? blankCustomer());
  const source = onSave && intake.extractionRef.current ? intake.extractionRef.current.records : workspace.records;
  const [originalGroup] = useState(() => groupRows(r, source));
  const editing = !onSave && workspace.records.some((x) => x.id === r.id);
  const targetIds = editing ? originalGroup.map((x) => x.id) : [];
  const [groupId] = useState(() => r.splitGroupId || draftKey || draftRows?.[0]?.splitGroupId || newId());
  const originalsById = useMemo(() => new Map(originalGroup.map((x) => [x.id, x])), [originalGroup]);
  const [lines, setLines] = useState<SplitLine[]>(() =>
    (draftRows || originalGroup).map((row) => ({
      id: row.id || newId(),
      fuel: row.fuels?.[0] || "",
      quantity: row.quantity === null || row.quantity === undefined ? "" : String(row.quantity),
      unit: row.unit || "L",
      custom: typeof row.customFuel === "string" ? row.customFuel : "",
    })),
  );
  const [f, setF] = useState({
    company: r.company,
    agreement: (r.agreement || "Non-binding LOI") as Agreement,
    period: r.period as Period,
    status: (r.status || "draft") as RecordStatus,
    location: r.location || "",
    segment: (r.segment || "Other") as Segment,
    stations: r.stations === null || r.stations === undefined ? "" : String(r.stations),
    validFrom: r.validFrom || "",
    validUntil: r.validUntil || "",
    notes: r.notes || "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const fuels = fuelOptions(workspace.records, lines.map((l) => l.fuel));
  const litersOf = (row: SenerRecord) =>
    typeof row.quantity === "number" && (row.unit === "L" || row.unit === "gal") ? row.quantity * (row.unit === "gal" ? G : 1) : 0;
  const previousTotal = originalGroup.reduce((sum, row) => sum + litersOf(row), 0);
  const evidence = [...new Set(originalGroup.map((x) => x.evidence).filter((x): x is string => Boolean(x)))];

  const totalText = (() => {
    try {
      let total = 0;
      let unknown = 0;
      for (const line of lines) {
        const qty = parseQuantity(line.quantity);
        if (qty === null || line.unit === "unknown") unknown++;
        else total += qty * (line.unit === "gal" ? G : 1);
      }
      return `${lines.length} fuel ${lines.length === 1 ? "split" : "splits"} · Total entered: ${num(total, 2)} L / ${f.period}${
        unknown ? ` · ${unknown} unresolved split(s)` : ""
      }`;
    } catch (err) {
      return errorMessage(err);
    }
  })();

  const addLine = () => {
    if (lines.length >= MAX_SPLITS) return toast("Maximum 30 product splits per editor.");
    setLines((ls) => [...ls, { id: newId(), fuel: "", quantity: "", unit: "L", custom: "" }]);
  };

  const build = (): SenerRecord[] => {
    const company = f.company.trim();
    if (!company) throw new Error("Enter a company name.");
    if (f.validFrom && f.validUntil && f.validFrom > f.validUntil) throw new Error("Valid-until cannot be before valid-from.");
    const used = new Set<string>();
    return lines.map((line) => {
      let fuel = line.fuel;
      if (fuel === "Other") {
        const exact = line.custom.trim();
        if (!EXACT_OTHER_RE.test(exact)) throw new Error("Enter the exact Other product name (2–71 ASCII characters).");
        fuel = "Other: " + exact;
      }
      if (!fuel || (!fuels.includes(fuel) && !fuel.startsWith("Other: "))) throw new Error("Select a fuel for every split.");
      if (used.has(fuel.toLowerCase())) {
        throw new Error("Each fuel can appear once in this breakdown. Combine duplicate product quantities.");
      }
      used.add(fuel.toLowerCase());
      const quantity = parseQuantity(line.quantity);
      if (f.status === "active" && (quantity === null || line.unit === "unknown" || ["unknown", "one-time"].includes(f.period))) {
        throw new Error("Active splits require a quantity, known unit and recurring period. Use Draft for unresolved values.");
      }
      const grouped = lines.length > 1 || Boolean(r.splitGroupId);
      return {
        ...(originalsById.get(line.id) || r),
        id: line.id,
        company,
        role: "customer",
        fuels: [fuel],
        quantity,
        unit: line.unit,
        period: f.period,
        status: f.status,
        agreement: f.agreement,
        location: f.location.trim(),
        segment: f.segment,
        stations: f.stations === "" ? null : Number(f.stations),
        validFrom: f.validFrom,
        validUntil: f.validUntil,
        notes: f.notes.trim(),
        ...(grouped ? { splitGroupId: groupId, manualSplit: true } : {}),
      };
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let results: SenerRecord[] | null = null;
    try {
      results = build();
      if (onSave) return onSave(results);
      setBusy(true);
      checkRecords(results);
      await ws.save({ ...workspace, records: replaceRows(workspace.records, targetIds, results) });
      drafts.remove("customer-splits", groupId);
      setModal(null);
      toast(`${results.length} customer fuel split(s) saved for everyone.`);
    } catch (err) {
      if (results && !onSave) {
        drafts.preserve({
          kind: "customer-splits",
          key: groupId,
          value: {
            docId: groupId,
            company: results[0].company,
            records: results,
            wasEditing: editing,
            baseRecordId: originalGroup[0]?.id || r.id,
            originalIds: targetIds,
            originalIdentity: splitIdentity(originalGroup[0] || r),
          },
        });
      }
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await ws.save({ ...workspace, records: workspace.records.filter((x) => !targetIds.includes(x.id)) });
      setModal(null);
      toast("Customer volume group removed; original document retained.");
    } catch (err) {
      toast(errorMessage(err));
      setBusy(false);
    }
  };

  if (confirmRemove) {
    return (
      <Modal
        title="Remove these customer fuel volumes?"
        subtitle="This deletes only this explicit customer split group for all users. The original document is retained."
        onClose={closeModal}
        footer={
          <>
            <button type="button" className={BTN_OUTLINE} onClick={() => setConfirmRemove(false)}>Keep volumes</button>
            <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => void remove()}>Remove these volumes</button>
          </>
        }
      >
        <strong className="text-slate-800">{r.company}</strong>
        <p className="text-sm text-slate-600">
          {originalGroup.length} volume line(s): {originalGroup.map((x) => x.fuels.join(" / ")).join(" · ")}. Export JSON first if needed.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title={editing ? "Edit customer fuel splits" : onSave ? "Review customer fuel splits" : "Add customer fuel splits"}
      subtitle="Enter each fuel separately. Saving replaces the previous customer volume(s), so the original total is not counted again."
      onClose={closeModal}
    >
      <form onSubmit={submit} className="space-y-4">
        {evidence.length > 0 && (
          <Notice>
            <strong>Original source evidence</strong>
            {evidence.map((ev) => <span key={ev} className="block">{ev}</span>)}
            Manually entered splits are reviewed planning values; the original letter remains unchanged.
          </Notice>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className={`${LABEL} sm:col-span-2`}>
            Company name
            <input className={INPUT} required maxLength={300} value={f.company} onChange={(e) => set("company", e.target.value)} />
          </label>
          <label className={LABEL}>
            Stage
            <select className={INPUT} disabled value="customer"><option value="customer">Customer</option></select>
            <span className="block text-xs font-normal text-slate-500 mt-1">This form edits customer product quantities.</span>
          </label>
          <label className={LABEL}>
            Agreement type
            <select className={INPUT} value={f.agreement} onChange={(e) => set("agreement", e.target.value as Agreement)}>
              {["Non-binding LOI", "Contract", "Unknown"].map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
        </div>
        <SplitBoxes
          lines={lines}
          fuels={fuels}
          onChange={setLines}
          onAdd={addLine}
          totalText={totalText}
          previousNote={`Previous entered total: ${num(previousTotal)} L / ${r.period || "unknown"}. gal means US liquid gallons (1 gal = 3.785411784 L). Save replaces these volume lines. Supplier/transport capacities and original documents are not changed.`}
          baseline={originalGroup}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className={LABEL}>
            Volume period
            <select className={INPUT} value={f.period} onChange={(e) => set("period", e.target.value as Period)}>
              {["monthly", "daily", "weekly", "annual", "one-time", "unknown"].map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className={LABEL}>
            Record status
            <select className={INPUT} value={f.status} onChange={(e) => set("status", e.target.value as RecordStatus)}>
              {["active", "draft", "inactive"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <span className="block text-xs font-normal text-slate-500 mt-1">Only reviewed, currently valid, active recurring quantities count.</span>
          </label>
          <label className={`${LABEL} sm:col-span-2`}>
            Location / delivery route
            <input className={INPUT} maxLength={1000} value={f.location} onChange={(e) => set("location", e.target.value)} />
          </label>
          <label className={LABEL}>
            Customer segment
            <select className={INPUT} value={f.segment} onChange={(e) => set("segment", e.target.value as Segment)}>
              {["Private fleet", "Station network", "Other"].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className={LABEL}>
            Number of stations
            <input className={INPUT} type="number" min={0} max={100000} step={1} value={f.stations} onChange={(e) => set("stations", e.target.value)} />
          </label>
          <label className={LABEL}>
            Valid from
            <input className={INPUT} type="date" value={f.validFrom} onChange={(e) => set("validFrom", e.target.value)} />
          </label>
          <label className={LABEL}>
            Valid until
            <input className={INPUT} type="date" value={f.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
          </label>
          <label className={`${LABEL} sm:col-span-2`}>
            Notes / qualification
            <textarea className={INPUT} rows={3} maxLength={5000} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </label>
        </div>
        {error && <Notice tone="red">{error}</Notice>}
        <RefBox>
          Different fuels are not interchangeable. Every saved split contributes only to its named product. Blank/unknown draft quantities do not enter the dashboard. Adding jet fuel demand does not create jet fuel supply or transport capacity.
        </RefBox>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {editing ? (
            <button type="button" className={BTN_DANGER} onClick={() => setConfirmRemove(true)}>Remove customer volumes</button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className={BTN_OUTLINE} onClick={() => (onSave ? intake.openReview() : closeModal())}>
              {onSave ? "Back to review" : "Cancel"}
            </button>
            <button type="submit" className={BTN_PRIMARY} disabled={busy}>
              {onSave ? "Confirm fuel splits" : "Save fuel splits"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
