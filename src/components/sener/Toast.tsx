"use client";

import { useEffect, useState } from "react";

export default function Toast({ toast }: { toast: { text: string; n: number } | null }) {
  const [hidden, setHidden] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setHidden(toast.n), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast || toast.n === hidden) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[70] max-w-md bg-slate-800 text-white text-sm px-4 py-3 rounded-lg shadow-lg"
    >
      {toast.text}
    </div>
  );
}
