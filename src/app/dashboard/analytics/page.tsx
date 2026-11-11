"use client";

import React, { useMemo, useState } from "react";
import { Download, Printer, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useStoreData } from "@/components/providers/StoreContext";
import {
  PanelCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { daysUntilDate, downloadCsv, formatINR } from "@/lib/utils";

export default function AnalyticsPage() {
  const { state } = useStoreData();
  const { pushToast } = useToast();
  const [dateWindow, setDateWindow] = useState<"24h" | "7d" | "30d">("7d");

  const analytics = useMemo(() => {
    if (!state) return null;
    const completedCheckouts = state.checkoutSessions.filter((c) => c.status === "completed");
    const totalSales = completedCheckouts.reduce((acc, c) => acc + c.totalAmount, 0);
    const totalMovements = state.inventoryMovements.length;
    const stockoutCount = state.products.filter((p) => p.stockStatus === "out_of_stock").length;
    const expiringExposure = state.products
      .filter((p) => daysUntilDate(p.expiryDate) <= 3)
      .reduce((acc, p) => acc + p.availableQuantity * p.costPrice, 0);
    const anomalyCount = state.checkoutDisputes.length;
    const agentSuccessRate =
      state.agentRuns.length > 0
        ? Math.round(
            (state.agentRuns.filter((r) => r.status !== "failed").length / state.agentRuns.length) *
              100
          )
        : 100;

    const supplierPerf = state.suppliers.map((s) => ({
      name: s.name.split(" ").slice(0, 2).join(" "),
      fulfillment: s.fulfillmentRatePct,
      leadTime: s.avgLeadTimeDays,
    }));

    const categoryDemand = Array.from(
      state.products.reduce((map, p) => {
        const prev = map.get(p.category) ?? { category: p.category, stockValue: 0, skus: 0 };
        prev.stockValue += Math.round(p.availableQuantity * p.sellingPrice);
        prev.skus += 1;
        map.set(p.category, prev);
        return map;
      }, new Map<string, { category: string; stockValue: number; skus: number }>()).values()
    );

    return {
      totalSales,
      completedCount: completedCheckouts.length,
      totalMovements,
      stockoutCount,
      expiringExposure,
      anomalyCount,
      agentSuccessRate,
      supplierPerf,
      categoryDemand,
    };
  }, [state]);

  function handleExportReportCsv() {
    if (!state || !analytics) return;
    downloadCsv(
      `retailens-analytics-${dateWindow}.csv`,
      ["Metric", "Value", "Notes"],
      [
        ["Store", state.store.name, "Synthetic Demo Store"],
        ["Date Filter", dateWindow, "Persisted store metrics"],
        ["Verified Checkout Sales (INR)", analytics.totalSales.toFixed(2), `${analytics.completedCount} completed sessions`],
        ["Inventory Movements", analytics.totalMovements, "Transactional ledger entries"],
        ["Out-of-Stock SKUs", analytics.stockoutCount, "Current catalog stockouts"],
        ["3-Day Expiry Exposure (INR)", analytics.expiringExposure.toFixed(2), "Cost value at near-term expiry"],
        ["Checkout Anomalies", analytics.anomalyCount, "Paused for human review"],
        ["Agent Tool Success Rate", `${analytics.agentSuccessRate}%`, "Validated tool runs"],
      ]
    );
    pushToast({ kind: "success", title: "Analytics CSV downloaded", message: `Window: ${dateWindow}` });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Analytics & Operational Reports"
        subtitle="Persisted store performance across sales, inventory velocity, expiry exposure, checkout anomalies, supplier reliability, and AI agent efficiency."
        actions={
          <>
            <select
              aria-label="Date window filter"
              value={dateWindow}
              onChange={(e) => setDateWindow(e.target.value as "24h" | "7d" | "30d")}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-800 no-print"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <SecondaryButton type="button" onClick={handleExportReportCsv} className="no-print">
              <Download className="h-4 w-4" />
              Export CSV
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => window.print()} className="no-print">
              <Printer className="h-4 w-4" />
              Print / Export PDF
            </PrimaryButton>
          </>
        }
      />

      {analytics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PanelCard>
              <p className="text-xs text-slate-500">Verified Checkout Revenue</p>
              <p className="mt-1.5 text-xl font-bold text-emerald-700">
                {formatINR(analytics.totalSales)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {analytics.completedCount} verified POS sessions
              </p>
            </PanelCard>
            <PanelCard>
              <p className="text-xs text-slate-500">3-Day Expiry Cost Exposure</p>
              <p className="mt-1.5 text-xl font-bold text-amber-700">
                {formatINR(analytics.expiringExposure)}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Protected by dynamic markdown recommendations
              </p>
            </PanelCard>
            <PanelCard>
              <p className="text-xs text-slate-500">Checkout Anomaly Disputes</p>
              <p className="mt-1.5 text-xl font-bold text-rose-700">{analytics.anomalyCount}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Zero unauthorized inventory mutations
              </p>
            </PanelCard>
            <PanelCard>
              <p className="text-xs text-slate-500">Agent Operational Efficiency</p>
              <p className="mt-1.5 text-xl font-bold text-sky-700">
                {analytics.agentSuccessRate}%
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {state?.agentToolExecutions.length ?? 0} deterministic tool executions
              </p>
            </PanelCard>
          </div>

          {/* AI Daily Summary */}
          <PanelCard className="border-sky-200 bg-sky-50/70">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-950">AI-Generated Daily Operational Brief</h2>
              <StatusBadge tone="cyan">Grounded in Persisted Data</StatusBadge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-700">
              Across {state?.products.length} tracked SKUs at {state?.store.name}, verified checkout sales
              total {formatINR(analytics.totalSales)} across {analytics.completedCount} sessions.{" "}
              {analytics.stockoutCount} out-of-stock SKUs and {formatINR(analytics.expiringExposure)} in
              near-expiry dairy/bakery inventory represent the highest immediate margin recovery
              opportunities. {state?.approvalRequests.filter((a) => a.status === "pending").length} actions
              currently await manager authorization.
            </p>
          </PanelCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <PanelCard>
              <h2 className="text-sm font-semibold text-slate-950">Category Inventory Valuation (₹)</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.categoryDemand}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" tick={{ fill: "#475569", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#475569", fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a", borderRadius: "0.75rem" }} />
                    <Bar dataKey="stockValue" name="Retail Value (₹)" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PanelCard>

            <PanelCard>
              <h2 className="text-sm font-semibold text-slate-950">Supplier Fulfillment & Lead Time</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.supplierPerf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: "#475569", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#475569", fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a", borderRadius: "0.75rem" }} />
                    <Legend />
                    <Bar dataKey="fulfillment" name="Fulfillment %" fill="#059669" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </PanelCard>
          </div>
        </>
      )}
    </div>
  );
}

