"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar group for the SENER import-permit workspace. Collapsible like the
// OPs Inventory group; always expanded for SENER-only (external) accounts.

const senerNavItems = [
  { href: "/sener", label: "Overview", icon: "overview" },
  { href: "/sener/counterparties", label: "Counterparties", icon: "people" },
  { href: "/sener/documents", label: "LOI Documents", icon: "documents" },
  { href: "/sener/scenarios", label: "Scenario Planner", icon: "scenario" },
] as const;

export default function SenerNavGroup({ alwaysOpen = false }: { alwaysOpen?: boolean }) {
  const pathname = usePathname();
  const isSenerActive = pathname === "/sener" || pathname.startsWith("/sener/");
  const [expanded, setExpanded] = useState(isSenerActive || alwaysOpen);
  const open = alwaysOpen || expanded;

  return (
    <div>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        disabled={alwaysOpen}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
          isSenerActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Shield-check icon: permits */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="font-medium text-sm">SENER Permits</span>
        </div>
        {!alwaysOpen && (
          <svg
            className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {open && (
        <ul className="mt-1 ml-4 space-y-1">
          {senerNavItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  <SenerNavIcon icon={item.icon} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SenerNavIcon({ icon }: { icon: string }) {
  const paths: Record<string, string> = {
    overview:
      "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    people:
      "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    documents:
      "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    scenario: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
  };
  const d = paths[icon];
  if (!d) return null;
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}
