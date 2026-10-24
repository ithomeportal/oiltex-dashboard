"use client";

import { useState, type DragEvent } from "react";
import { useSener } from "./SenerContext";
import { Icon } from "./ui";

interface Props {
  variant?: "overview" | "documents" | "modal";
}

const COPY = {
  overview: {
    title: "Turn letters into numbers.",
    body: "Drop a letter of intent here. We’ll read it and identify the company, product and volume for your review.",
    small: "PDF, DOCX, TXT or image · up to 15 MB",
  },
  documents: {
    title: "Drag & drop your PDF or Word letter here",
    body: "Keep the original, preview it, and review extracted volumes before they count.",
    small: "PDF · Word DOCX · TXT · Images · up to 15 MB",
  },
  modal: {
    title: "Drag a document here",
    body: "PDF, DOCX, TXT, PNG, JPG or WEBP. English and Spanish supported.",
    small: "Maximum 15 MB",
  },
};

export default function DropTile({ variant = "overview" }: Props) {
  const { pickFiles, intake, toast, setModal } = useSener();
  const [over, setOver] = useState(false);
  const copy = COPY[variant];

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (intake.busyRef.current || intake.extractionRef.current) {
      toast("Complete the current document review before adding another.");
      return;
    }
    const files = [...e.dataTransfer.files];
    if (!files.length) return;
    if (variant === "modal") setModal(null);
    intake.enqueue(files);
  };

  return (
    <section
      role="button"
      tabIndex={0}
      aria-label="Upload letter of intent"
      onClick={pickFiles}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pickFiles();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center text-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${
        over ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"
      }`}
    >
      <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
        <Icon name="upload" className="w-6 h-6" />
      </span>
      <h3 className="text-base font-semibold text-slate-800">{copy.title}</h3>
      <p className="text-sm text-slate-500 max-w-sm">{copy.body}</p>
      <span className="text-sm font-medium text-blue-600">Browse files ↗</span>
      <small className="text-xs text-slate-400">{copy.small}</small>
    </section>
  );
}
