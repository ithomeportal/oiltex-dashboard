"use client";

import SenerPage from "@/components/sener/SenerPage";
import ScenarioControls from "@/components/sener/ScenarioControls";
import ScenarioResult from "@/components/sener/ScenarioResult";
import TransportAllocationTable from "@/components/sener/TransportAllocationTable";
import { useSener } from "@/components/sener/SenerContext";

export default function SenerScenariosPage() {
  return (
    <SenerPage
      title="Find your next balanced month."
      subtitle="Adjust potential volumes. See what changes. Keep your records intact."
    >
      <ScenarioIntro />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 *:min-w-0">
        <ScenarioControls />
        <ScenarioResult />
      </div>
      <TransportAllocationTable />
    </SenerPage>
  );
}

function ScenarioIntro() {
  const { period } = useSener();
  return (
    <div className="mb-4">
      <span className="text-xs font-semibold tracking-wider text-slate-400">WHAT-IF WORKSPACE</span>
      <h2 className="text-lg font-semibold text-slate-800">What would a balanced {period.unit} look like?</h2>
      <p className="text-sm text-slate-500">Explore changes without changing any letters or source commitments.</p>
    </div>
  );
}
