"use client";

import type { ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import SenerProvider from "@/components/sener/SenerProvider";
import SenerTopBar from "@/components/sener/SenerTopBar";
import ModalHost from "@/components/sener/ModalHost";

// One provider for all SENER pages so the shared workspace, polling, open
// reviews and uploads survive navigation between Overview / Counterparties /
// Documents / Scenarios.
export default function SenerLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardLayout>
      <SenerProvider>
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <SenerTopBar />
            {children}
          </div>
        </div>
        <ModalHost />
      </SenerProvider>
    </DashboardLayout>
  );
}
