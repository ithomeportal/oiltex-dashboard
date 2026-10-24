"use client";

import SenerPage from "@/components/sener/SenerPage";
import StageCards from "@/components/sener/StageCards";
import BalancePanel from "@/components/sener/BalancePanel";
import ProductTable from "@/components/sener/ProductTable";
import DropTile from "@/components/sener/DropTile";
import CounterpartyRegister from "@/components/sener/CounterpartyRegister";

export default function SenerOverviewPage() {
  return (
    <SenerPage title="See the whole supply chain." subtitle="One clear view of your supply, transport and customer demand.">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold text-slate-800">Three stages. One balance.</h2>
        <span className="text-xs text-slate-500">US liquid gallons · 1 gal = 3.785411784 L</span>
      </div>
      <StageCards />
      <BalancePanel />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8 *:min-w-0">
        <ProductTable />
        <DropTile variant="overview" />
      </div>
      <CounterpartyRegister />
    </SenerPage>
  );
}
