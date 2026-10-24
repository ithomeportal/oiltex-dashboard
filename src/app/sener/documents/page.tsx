"use client";

import SenerPage from "@/components/sener/SenerPage";
import DropTile from "@/components/sener/DropTile";
import DocumentRegister from "@/components/sener/DocumentRegister";

export default function SenerDocumentsPage() {
  return (
    <SenerPage
      title="Every letter. One source of truth."
      subtitle="Read, review and register letters of intent without retyping."
    >
      <div className="mb-6">
        <DropTile variant="documents" />
      </div>
      <DocumentRegister />
    </SenerPage>
  );
}
