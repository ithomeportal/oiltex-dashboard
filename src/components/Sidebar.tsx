"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ARGUS_NAV, MARKET_NAV, NAV_ICONS, OPS_GROUP, SENER_GROUP, type NavGroup, type NavItem } from "./nav-config";

interface SidebarProps {
  email: string;
  isAdmin: boolean;
  senerOnly?: boolean; // external SENER-scoped account: show only the SENER group
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Mobile drawer state (below lg). */
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export function NavIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const d = NAV_ICONS[name];
  if (!d) return null;
  return (
    <svg className={`${className} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  );
}

export default function Sidebar({
  email,
  isAdmin,
  senerOnly = false,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={onCloseMobile} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-300 transition-[width,transform] duration-200
          ${collapsed ? "lg:w-16" : "lg:w-60"} w-64
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        {/* Logo + collapse toggle */}
        <div className={`flex items-center h-16 border-b border-slate-800 ${collapsed ? "lg:justify-center px-3" : "justify-between px-4"}`}>
          <Link href={senerOnly ? "/sener" : "/"} className={collapsed ? "lg:hidden" : ""} onClick={onCloseMobile}>
            <Image src="/logo.png" alt="OilTex" width={120} height={48} priority />
          </Link>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-4" onClick={onCloseMobile}>
          {senerOnly ? (
            <ul className="space-y-0.5">
              <Group group={SENER_GROUP} pathname={pathname} collapsed={collapsed} alwaysOpen />
            </ul>
          ) : (
            <>
              <Section title="Market" collapsed={collapsed}>
                {MARKET_NAV.map((item) => (
                  <NavLink key={item.href} item={item} active={pathname === item.href} collapsed={collapsed} />
                ))}
              </Section>
              <Section title="Argus" collapsed={collapsed}>
                {ARGUS_NAV.map((item) => (
                  <NavLink key={item.href} item={item} active={pathname === item.href} collapsed={collapsed} />
                ))}
              </Section>
              <Section title="Operations" collapsed={collapsed}>
                <Group group={OPS_GROUP} pathname={pathname} collapsed={collapsed} />
                <Group group={SENER_GROUP} pathname={pathname} collapsed={collapsed} />
              </Section>
            </>
          )}
        </nav>

        {/* User */}
        <div className="border-t border-slate-800 p-3">
          <div className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : ""}`}>
            <div
              className="h-9 w-9 shrink-0 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold text-white"
              title={email}
            >
              {email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              {isAdmin && (
                <span className="bg-purple-500 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">Admin</span>
              )}
              <p className="text-xs text-slate-400 truncate mt-0.5">{email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Logout"
            className={`mt-2 w-full flex items-center gap-2 h-9 rounded-lg text-sm text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors ${
              collapsed ? "lg:justify-center px-3" : "justify-center px-3"
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={collapsed ? "lg:hidden" : ""}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

function Section({ title, collapsed, children }: { title: string; collapsed: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className={`px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 ${collapsed ? "lg:hidden" : ""}`}>
        {title}
      </p>
      {collapsed && <div className="hidden lg:block mx-3 mb-2 border-t border-slate-800" />}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function NavLink({ item, active, collapsed, nested = false }: { item: NavItem; active: boolean; collapsed: boolean; nested?: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 h-9 rounded-lg text-sm transition-colors
          ${collapsed ? "lg:justify-center px-3" : nested ? "pl-9 pr-3" : "px-3"}
          ${active ? "bg-blue-600 text-white font-medium" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
      >
        <NavIcon name={item.icon} className={nested ? "w-4 h-4" : "w-5 h-5"} />
        <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
      </Link>
    </li>
  );
}

function Group({
  group,
  pathname,
  collapsed,
  alwaysOpen = false,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  alwaysOpen?: boolean;
}) {
  const active = pathname === group.prefix || pathname.startsWith(`${group.prefix}/`);
  const [expanded, setExpanded] = useState(active || alwaysOpen);
  const open = alwaysOpen || expanded;

  return (
    <li>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((prev) => !prev);
        }}
        disabled={alwaysOpen}
        className={`w-full flex items-center gap-3 h-9 px-3 rounded-lg text-sm transition-colors ${collapsed ? "lg:hidden" : ""} ${
          active ? "text-white font-medium" : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <NavIcon name={group.icon} />
        <span className="flex-1 text-left truncate">{group.label}</span>
        {!alwaysOpen && (
          <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>
      {/* Collapsed rail: show the group's pages as icons directly. */}
      <ul className={`mt-0.5 space-y-0.5 ${open ? "" : "hidden"} ${collapsed ? "lg:block" : ""}`}>
        {group.items.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} collapsed={collapsed} nested />
        ))}
      </ul>
    </li>
  );
}
