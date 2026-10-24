"use client";

import { useState, type FormEvent } from "react";
import type { Agreement, Period, RecordStatus, Role, SenerRecord, Unit } from "@/lib/sener/types";
import { EXACT_OTHER_RE, errorMessage, fuelOptions, monthLiters, newId, num } from "@/lib/sener/ui-helpers";
import { useSener } from "./SenerContext";
import { checkRecords } from "./upload";
import type { SaveRows } from "./sener-types";
import { BTN_DANGER, BTN_OUTLINE, BTN_PRIMARY, INPUT, LABEL, Modal, Notice, RefBox } from "./ui";

const PERIODS: Period[] = ["monthly", "daily", "weekly", "annual", "one-time", "unknown"];
const AGREEMENTS: Agreement[] = ["Non-binding LOI", "Contract", "Unknown"];

function blankRecord(): SenerRecord {
  return {
    id: newId(),
    company: "",
    role: "supplier",
    fuels: ["Diesel"],
    quantity: null,
    unit: "gal",
    period: "monthly",
    agreement: "Non-binding LOI",
    status: "active",
    segment: "Private fleet",
    location: "",
    notes: "",
  };
}

interface Props {
  record: SenerRecord | null;
  onSave?: SaveRows;
}

/** Supplier / transport editor (app.js openRecord). Switching stage to Customer opens the splits editor. */
export default function RecordModal({ record, onSave }: Props) {
  const { workspace, ws, closeModal, setModal, intake, drafts, toast, today } = useSener();
  const [r] = useState<SenerRecord>(() => record ?? blankRecord());
  const editing = workspace.records.some((x) => x.id === r.id) && !onSave;
  const fromExtraction = Boolean(onSave);
  const [f, setF] = useState({
    company: r.company,
    role: (r.role || "") as Role | "",
    agreement: (r.agreement || "Non-binding LOI") as Agreement,
    fuels: r.fuels || [],
    customFuel: "",
    quantity: r.quantity === null || r.quantity === undefined ? "" : String(r.quantity),
    unit: r.unit as Unit,
    period: r.period as Period,
    status: (r.status || "draft") as RecordStatus,
    location: r.location || "",
    validFrom: r.validFrom || "",
    validUntil: r.validUntil || "",
    notes: r.notes || "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fuels = fuelOptions(workspace.records, f.fuels);
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((prev) => ({ ...prev, [key]: value }));

  const back = () => (fromExtraction ? intake.openReview() : closeModal());

  const changeRole = (role: Role | "") => {
    if (role !== "customer") return set("role", role);
    setModal({
      kind: "splits",
      onSave,
      record: {
        ...r,
        role: "customer",
        company: f.company.trim(),
        fuels: [f.fuels[0] || r.fuels?.[0] || "Gasoline"],
        quantity: f.quantity === "" ? null : Number(f.quantity),
        unit: f.quantity === "" && !editing && !onSave ? "L" : f.unit,
        period: f.period,
        status: f.status,
        agreement: f.agreement,
        location: f.location.trim(),
        notes: f.notes.trim(),
        validFrom: f.validFrom,
        validUntil: f.validUntil,
      },
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let chosen = f.fuels;
    if (chosen.includes("Other")) {
      const custom = f.customFuel.trim();
      if (!EXACT_OTHER_RE.test(custom)) {
        setError("For Other, enter the exact product name (2–71 ASCII characters). Different additional fuels must not be combined.");
        return;
      }
      chosen = chosen.map((x) => (x === "Other" ? "Other: " + custom : x));
    }
    const quantity = f.quantity.trim() === "" ? null : Number(f.quantity);
    const result: SenerRecord = {
      ...r,
      id: r.id || newId(),
      company: f.company.trim(),
      role: f.role as Role,
      fuels: chosen,
      quantity,
      unit: f.unit,
      period: f.period,
      agreement: f.agreement,
      status: f.status,
      location: f.location.trim(),
      segment: "",
      stations: null,
      validFrom: f.validFrom,
      validUntil: f.validUntil,
      notes: f.notes.trim(),
    };
    const problem = !result.company
      ? "Enter a company name."
      : !f.role
        ? "Select a stage."
        : !chosen.length
          ? "Select at least one fuel product."
          : result.validFrom && result.validUntil && result.validFrom > result.validUntil
            ? "Valid-until cannot be before valid-from."
            : result.status === "active" &&
                (quantity === null || Number.isNaN(quantity) || result.unit === "unknown" || ["unknown", "one-time"].includes(result.period))
              ? "An active monthly record needs a quantity, known unit and recurring period. Save as draft for unresolved facts."
              : null;
    if (problem) return setError(problem);
    if (onSave) return onSave([result]);
    setBusy(true);
    try {
      checkRecords([result]);
      const records = editing ? workspace.records.map((x) => (x.id === r.id ? result : x)) : [...workspace.records, result];
      await ws.save({ ...workspace, records });
      drafts.remove("record", result.id);
      setModal(null);
      toast(editing ? "Counterparty updated for everyone." : "Counterparty shared with everyone.");
    } catch (err) {
      drafts.preserve({ kind: "record", key: result.id, value: result });
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await ws.save({ ...workspace, records: workspace.records.filter((x) => x.id !== r.id) });
      setModal(null);
      toast("Volume record removed from shared workspace.");
    } catch (err) {
      toast(errorMessage(err));
      setBusy(false);
    }
  };

  if (confirmRemove) {
    return (
      <Modal
        title="Remove this volume record?"
        subtitle="This removes it from the shared register and all balances for everyone."
        onClose={closeModal}
        footer={
          <>
            <span />
            <div className="flex gap-2">
              <button type="button" className={BTN_OUTLINE} onClick={() => setConfirmRemove(false)}>
                Keep record
              </button>
              <button type="button" className={BTN_DANGER} disabled={busy} onClick={() => void remove()}>
                Remove record
              </button>
            </div>
          </>
        }
      >
        <strong className="text-slate-800">{r.company}</strong>
        <p className="text-sm text-slate-600">
          {r.fuels.join(" · ")} · {num(monthLiters(r, today))} L / month. Export JSON first if you need a backup.
        </p>
      </Modal>
    );
  }

  const title = editing ? "Edit counterparty" : fromExtraction ? "Review extracted volume" : "Add a counterparty";
  return (
    <Modal
      title={title}
      subtitle="Customers have one volume line per product. Suppliers and transporters may share one total capacity across products."
      onClose={closeModal}
    >
      <form onSubmit={submit} className="space-y-4">
        {r.evidence && (
          <Notice>
            <strong>Source evidence</strong>
            <br />
            {r.evidence}
            <br />
            Extraction confidence: {r.confidence || "not rated"}. Verify against the original document.
          </Notice>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className={`${LABEL} sm:col-span-2`}>
            Company name
            <input className={INPUT} required maxLength={300} value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Counterparty legal name" />
          </label>
          <label className={LABEL}>
            Stage
            <select className={INPUT} required value={f.role} onChange={(e) => changeRole(e.target.value as Role | "")}>
              <option value="">Select a stage</option>
              <option value="supplier">supplier</option>
              <option value="transport">transport</option>
              <option value="customer">customer</option>
            </select>
          </label>
          <label className={LABEL}>
            Agreement type
            <select className={INPUT} value={f.agreement} onChange={(e) => set("agreement", e.target.value as Agreement)}>
              {AGREEMENTS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <div className={`${LABEL} sm:col-span-2`}>
            Fuel product(s)
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
              {fuels.map((fuel) => (
                <label key={fuel} className="inline-flex items-center gap-2 text-sm font-normal text-slate-700">
                  <input
                    type="checkbox"
                    checked={f.fuels.includes(fuel)}
                    onChange={(e) => set("fuels", e.target.checked ? [...f.fuels, fuel] : f.fuels.filter((x) => x !== fuel))}
                  />
                  {fuel}
                </label>
              ))}
            </div>
            <input className={`${INPUT} mt-2`} maxLength={70} value={f.customFuel} onChange={(e) => set("customFuel", e.target.value)} placeholder="If Other is selected: exact product name, e.g. Ethanol" />
            <span className="block text-xs font-normal text-slate-500 mt-1">
              For a supplier/transport pool, select all eligible products and enter the combined quantity ONCE. Customers need separate product quantities.
            </span>
          </div>
          <label className={LABEL}>
            Stated quantity
            <input className={INPUT} type="number" min={0} max={10_000_000_000_000} step="any" value={f.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="Leave blank if unknown" />
          </label>
          <label className={LABEL}>
            Stated unit
            <select className={INPUT} value={f.unit} onChange={(e) => set("unit", e.target.value as Unit)}>
              {["gal", "L", "unknown"].map((u) => <option key={u}>{u}</option>)}
            </select>
            <span className="block text-xs font-normal text-slate-500 mt-1">gal = US liquid gallons only</span>
          </label>
          <label className={LABEL}>
            Volume period
            <select className={INPUT} value={f.period} onChange={(e) => set("period", e.target.value as Period)}>
              {PERIODS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className={LABEL}>
            Record status
            <select className={INPUT} value={f.status} onChange={(e) => set("status", e.target.value as RecordStatus)}>
              {["active", "draft", "inactive"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <span className="block text-xs font-normal text-slate-500 mt-1">Only reviewed active recurring volumes count.</span>
          </label>
          <label className={`${LABEL} sm:col-span-2`}>
            Location / transport route
            <input className={INPUT} maxLength={1000} value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="City, state, terminal or described route" />
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
          Non-binding intent is not an enforceable commitment. Daily volumes use 30 days/month, weekly 52/12 and annual 1/12. Unknown and one-time periods do not count toward monthly capacity.
        </RefBox>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {editing ? (
            <button type="button" className={BTN_DANGER} onClick={() => setConfirmRemove(true)}>
              Remove record
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className={BTN_OUTLINE} onClick={back}>
              {fromExtraction ? "Back to review" : "Cancel"}
            </button>
            <button type="submit" className={BTN_PRIMARY} disabled={busy}>
              {fromExtraction ? "Confirm this volume" : "Save counterparty"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
