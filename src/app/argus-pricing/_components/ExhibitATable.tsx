import { Panel } from "@/components/ui/Panel";
import { TABLE, TD, TD_NUM, TH, TH_NUM, TR } from "@/components/ui/styles";
import { LEASE_DIFFERENTIALS } from "../_lib";

export function ExhibitATable({ selectedLease }: { selectedLease: string }) {
  return (
    <div id="exhibit-a" className="scroll-mt-20">
      <Panel
        flush
        title="Exhibit A — Transportation Differentials"
        subtitle="Includes Big Star Crude truck rate (one-way mileage) + $0.25 Marathon unloading + OilTex margin. All plus FSC."
      >
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead>
              <tr>
                <th className={TH}>Location</th>
                <th className={TH}>County</th>
                <th className={TH_NUM}>Lease Diff</th>
                <th className={`${TH} text-center`}>Base Price</th>
              </tr>
            </thead>
            <tbody>
              {LEASE_DIFFERENTIALS.map((lease) => {
                const selected = lease.name === selectedLease;
                return (
                  <tr key={lease.name} className={selected ? "bg-blue-50" : TR}>
                    <td className={`${TD} font-medium text-slate-900`}>
                      {lease.name}
                      {selected && (
                        <span className="ml-2 text-[11px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                          selected
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-slate-500`}>{lease.county}</td>
                    <td className={`${TD_NUM} text-bad`}>-${lease.diff.toFixed(2)}</td>
                    <td className={`${TD} text-center`}>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          lease.base === "WTL" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {lease.base}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
