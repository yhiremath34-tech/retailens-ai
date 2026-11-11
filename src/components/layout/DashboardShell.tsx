"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  Camera,
  CheckSquare,
  ClipboardList,
  FlaskConical,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScanBarcode,
  Settings,
  ShieldCheck,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { RetaiLensLogo } from "@/components/ui/Logo";
import { useStoreData } from "@/components/providers/StoreContext";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/primitives";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/vision", label: "Live Vision", icon: Camera },
  { href: "/dashboard/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard/checkout", label: "Checkout Monitor", icon: ScanBarcode },
  { href: "/dashboard/agent", label: "AI Agent", icon: Bot },
  { href: "/dashboard/memory", label: "Agent Memory", icon: BrainCircuit },
  { href: "/dashboard/pricing", label: "Dynamic Pricing", icon: Tag },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
  { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: ClipboardList },
  { href: "/dashboard/approvals", label: "Approval Center", icon: CheckSquare },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/timeline", label: "Event Timeline", icon: Activity },
  { href: "/dashboard/demo", label: "Demo Center", icon: FlaskConical },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, session, modes } = useStoreData();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pendingApprovals =
    state?.approvalRequests.filter((a) => a.status === "pending").length ?? 0;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white text-slate-800">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
        <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
          <RetaiLensLogo />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Active Store
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Online
          </span>
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-slate-900">
          {state?.store.name ?? "Retail Demo Market – Store 01"}
        </p>
        <p className="truncate text-[11px] text-slate-500">
          {modes?.databaseMode === "supabase" ? "Connected PostgreSQL" : "Synthetic Simulation DB"}
        </p>
      </div>

      <nav aria-label="Primary dashboard navigation" className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sky-200/80 text-slate-950 font-semibold ring-1 ring-inset ring-sky-400/70"
                  : "text-slate-600 hover:bg-sky-50 hover:text-slate-950"
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4", active ? "text-sky-700" : "text-slate-500")} />
                {item.label}
              </span>
              {item.href === "/dashboard/approvals" && pendingApprovals > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  {pendingApprovals}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3">
        <Link
          href="/how-it-works"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-sky-50 hover:text-slate-950"
        >
          <HelpCircle className="h-4 w-4 text-sky-600" />
          How RetaiLens Works
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvb] bg-white text-slate-900">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 lg:sticky lg:top-0 lg:block lg:h-[100dvb]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 w-72 max-w-[85vw] border-r border-slate-200 bg-white">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col bg-slate-50/40">
        <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-sky-200 bg-sky-50 p-2 text-slate-800 hover:bg-sky-100 lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone="cyan">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                Agent Autonomous Loop Active
              </StatusBadge>
              <StatusBadge tone={modes?.databaseMode === "supabase" ? "green" : "amber"}>
                {modes?.databaseMode === "supabase" ? "Supabase Connected" : "Simulation Mode"}
              </StatusBadge>
              <StatusBadge tone={modes?.aiPlannerMode === "gemini" ? "blue" : "neutral"}>
                {modes?.aiPlannerMode === "gemini" ? "Gemini Tool Calling" : "Deterministic ReAct"}
              </StatusBadge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {pendingApprovals > 0 && (
              <Link
                href="/dashboard/approvals"
                className="hidden items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 sm:inline-flex"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {pendingApprovals} Pending Approval{pendingApprovals > 1 ? "s" : ""}
              </Link>
            )}
            {session && (
              <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
                <div className="text-right leading-tight">
                  <p className="text-xs font-semibold text-slate-900">{session.fullName}</p>
                  <p className="text-[11px] font-medium text-sky-700">{ROLE_LABELS[session.role]}</p>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-white p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

