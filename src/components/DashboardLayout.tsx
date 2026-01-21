"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        if (data.email) setEmail(data.email);
        if (data.isAdmin) setIsAdmin(data.isAdmin);
        if (!data.authenticated) {
          router.push("/login");
        }
      });
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  };

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar email={email} isAdmin={isAdmin} onLogout={handleLogout} />
      <main className="ml-64">
        {children}
      </main>
    </div>
  );
}
