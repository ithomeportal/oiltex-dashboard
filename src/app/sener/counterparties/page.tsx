"use client";

import SenerPage from "@/components/sener/SenerPage";
import CounterpartyRegister from "@/components/sener/CounterpartyRegister";

export default function SenerCounterpartiesPage() {
  return (
    <SenerPage
      title="The companies behind the volumes."
      subtitle="Documented intentions, locations and volumes — connected."
    >
      <CounterpartyRegister />
    </SenerPage>
  );
}
