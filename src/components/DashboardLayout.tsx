"use client";

import { useState, useEffect, ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

const COLLAPSE_KEY = "oiltex.sidebar.collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [senerOnly, setSenerOnly] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.email) setEmail(data.email);
        if (data.isAdmin) setIsAdmin(data.isAdmin);
        setSenerOnly(data.scope === "sener");
        if (!data.authenticated) {
          router.push("/login");
        }
      });
  }, [router]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // storage unavailable (private mode) — preference just isn't remembered
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <span className="h-6 w-6 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-page">
      <Sidebar
        email={email}
        isAdmin={isAdmin}
        senerOnly={senerOnly}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-slate-900">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-800"
          aria-label="Open navigation"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Image src="/logo.png" alt="OilTex" width={90} height={36} />
      </div>
      <main className={`min-w-0 transition-[padding] duration-200 ${collapsed ? "lg:pl-16" : "lg:pl-60"}`}>{children}</main>
    </div>
  );
}
