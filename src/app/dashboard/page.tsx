"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  FlaskConical,
  Package,
  ScanBarcode,
  ShieldAlert,
  TrendingDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
  SkeletonBlock,
  StatusBadge,
} from "@/components/ui/primitives";
import { daysUntilDate, formatINR, formatRelativeTime } from "@/lib/utils";

const CHART_COLORS = ["#3b82f6", "#22d3ee", "#10b981", "#f59e0b", "#ef4444"];

export default function OverviewPage() {
  const { state, modes, loading, error, refresh } = useStoreData();

  const metrics = useMemo(() => {
    if (!state) return null;
    const totalSkus = state.products.length;
    const availableUnits = state.products.reduce((a, p) => a + p.availableQuantity, 0);
    const lowStock = state.products.filter((p) => p.stockStatus === "low_stock");
    const outOfStock = state.products.filter((p) => p.stockStatus === "out_of_stock");
    const expiringSoon = state.products.filter(
      (p) => daysUntilDate(p.expiryDate) <= state.pricingRules.expiryAlertWindowDays
    );
    const activeCheckouts = state.checkoutSessions.filter(
      (c) => c.status === "active" || c.status === "paused_review"
    );
    const pendingApprovals = state.approvalRequests.filter((a) => a.status === "pending");

    const expiryRiskValue = expiringSoon.reduce(
      (acc, p) => acc + p.availableQuantity * p.costPrice,
      0
    );
    const stockoutRiskValue = [...lowStock, ...outOfStock].reduce(
      (acc, p) => acc + Math.max(0, p.minStockThreshold - p.availableQuantity) * p.sellingPrice,
      0
    );
    const estimatedInventoryRisk = expiryRiskValue + stockoutRiskValue;

    // Chart 1: Inventory Trends by Category
    const categoryTotals = new Map<string, { category: string; units: number; value: number }>();
    for (const p of state.products) {
      const curr = categoryTotals.get(p.category) ?? { category: p.category, units: 0, value: 0 };
      curr.units += p.availableQuantity;
      curr.value += p.availableQuantity * p.sellingPrice;
      categoryTotals.set(p.category, curr);
    }

    // Chart 2: Stock Depletion (lowest coverage SKUs)
    const stockDepletion = [...state.products]
      .sort((a, b) => a.availableQuantity - b.availableQuantity)
      .slice(0, 6)
      .map((p) => ({
        sku: p.sku.replace("SKU-", ""),
        qty: p.availableQuantity,
        min: p.minStockThreshold,
      }));

    // Chart 3: Checkout Activity
    const checkoutActivity = state.checkoutSessions.slice(0, 8).reverse().map((c, idx) => ({
      session: `#${idx + 1}`,
      amount: c.totalAmount,
      confidence: c.visualConfidence,
    }));

    // Chart 4: Expiry Risk Buckets
    const expiryBuckets = [
      {
        window: "0-2d",
        count: state.products.filter((p) => daysUntilDate(p.expiryDate) <= 2).length,
      },
      {
        window: "3-5d",
        count: state.products.filter((p) => {
          const d = daysUntilDate(p.expiryDate);
          return d >= 3 && d <= 5;
        }).length,
      },
      {
        window: "6-10d",
        count: state.products.filter((p) => {
          const d = daysUntilDate(p.expiryDate);
          return d >= 6 && d <= 10;
        }).length,
      },
      {
        window: ">10d",
        count: state.products.filter((p) => daysUntilDate(p.expiryDate) > 10).length,
      },
    ];

    // Chart 5: Discount Activity
    const discountActivity = state.priceRecommendations.slice(0, 5).map((r) => ({
      sku: r.sku.replace("SKU-", ""),
      discountPct: r.discountPct,
      savings: Number(((r.originalPrice - r.recommendedPrice) * 10).toFixed(0)),
    }));

    // Chart 6: Agent Action Distribution
    const toolCounts = new Map<string, number>();
    for (const te of state.agentToolExecutions) {
      toolCounts.set(te.toolName, (toolCounts.get(te.toolName) ?? 0) + 1);
    }
    const agentDistribution = Array.from(toolCounts.entries()).map(([name, count]) => ({
      name: name.replace(/_/g, " ").slice(0, 18),
      value: count,
    }));
    if (agentDistribution.length === 0) {
      agentDistribution.push({ name: "get inventory", value: 2 });
    }

    return {
      totalSkus,
      availableUnits,
      lowStock,
      outOfStock,
      expiringSoon,
      activeCheckouts,
      pendingApprovals,
      estimatedInventoryRisk,
      categoryChart: Array.from(categoryTotals.values()),
      stockDepletion,
      checkoutActivity,
      expiryBuckets,
      discountActivity,
      agentDistribution,
    };
  }, [state]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-16" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !state || !metrics) {
    return (
      <PanelCard className="border-rose-500/40 bg-rose-950/20">
        <p className="text-sm font-semibold text-rose-300">
          Failed to load command center: {error || "Unavailable"}
        </p>
        <SecondaryButton onClick={refresh} className="mt-3">
          Retry
        </SecondaryButton>
      </PanelCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Executive Command Center"
        subtitle={`${state.store.name} • Live autonomous store perception, inventory risk, checkout integrity, and approval queues (Synthetic Demo Dataset).`}
        actions={
          <>
            <Link href="/dashboard/demo">
              <PrimaryButton type="button">
                <FlaskConical className="h-4 w-4" />
                Launch Demo Scenarios
              </PrimaryButton>
            </Link>
            <Link href="/dashboard/agent">
              <SecondaryButton type="button">
                <Bot className="h-4 w-4 text-cyan-400" />
                Open AI Agent
              </SecondaryButton>
            </Link>
          </>
        }
      />

      {/* Top Status Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <PanelCard>
          <p className="text-xs font-medium text-slate-400">Store Operational Status</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold capitalize text-emerald-400">
              {state.store.operationalStatus}
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{state.store.code} • {state.store.timezone}</p>
        </PanelCard>

        <PanelCard>
          <p className="text-xs font-medium text-slate-400">AI Agent Status</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-cyan-300">
              {metrics.pendingApprovals.length > 0 ? "Awaiting Approval" : "Monitoring"}
            </span>
            <Bot className="h-5 w-5 text-cyan-400" />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Planner: {modes?.aiPlannerMode === "gemini" ? "Gemini API" : "Deterministic ReAct"}
          </p>
        </PanelCard>

        <PanelCard>
          <p className="text-xs font-medium text-slate-400">Tracked SKUs / Units</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-white">
              {metrics.totalSkus} SKUs
            </span>
            <Package className="h-5 w-5 text-blue-400" />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {metrics.availableUnits.toLocaleString("en-IN")} units in store inventory
          </p>
        </PanelCard>

        <PanelCard>
          <p className="text-xs font-medium text-slate-400">Stock & Expiry Alerts</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-amber-300">
              {metrics.lowStock.length} Low • {metrics.outOfStock.length} Out
            </span>
            <AlertTriangle className="h-5 w-5 text-amber-400" />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {metrics.expiringSoon.length} products within {state.pricingRules.expiryAlertWindowDays}d expiry
          </p>
        </PanelCard>

        <PanelCard>
          <p className="text-xs font-medium text-slate-400">Estimated Inventory Risk</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-rose-400">
              {formatINR(metrics.estimatedInventoryRisk)}
            </span>
            <TrendingDown className="h-5 w-5 text-rose-400" />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {metrics.pendingApprovals.length} pending approvals • {metrics.activeCheckouts.length} flagged checkouts
          </p>
        </PanelCard>
      </div>

      {/* Operational Summary Banner */}
      <PanelCard className="border-blue-500/25 bg-gradient-to-r from-blue-950/35 via-[#0f1623] to-cyan-950/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge tone="blue">Daily AI Operational Summary</StatusBadge>
              <span className="text-xs text-slate-400">
                Updated {formatRelativeTime(state.auditLogs[0]?.createdAt ?? new Date().toISOString())}
              </span>
            </div>
            <p className="text-sm text-slate-200">
              {metrics.outOfStock.length} SKU stocked out ({metrics.outOfStock.map((p) => p.sku).join(", ") || "None"}),{" "}
              {metrics.lowStock.length} SKUs below safety threshold, and{" "}
              {metrics.expiringSoon.length} perishable SKUs flagged for dynamic expiry pricing.{" "}
              {metrics.pendingApprovals.length} high-impact actions await Store Manager review.
            </p>
          </div>
          <Link href="/dashboard/approvals">
            <SecondaryButton type="button">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              Review {metrics.pendingApprovals.length} Approvals
            </SecondaryButton>
          </Link>
        </div>
      </PanelCard>

      {/* 6 Visualizations Grid */}
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <PanelCard>
          <h2 className="text-sm font-semibold text-slate-200">Inventory Units by Category</h2>
          <p className="text-xs text-slate-400">Live store stock distribution</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.categoryChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="category" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                <Bar dataKey="units" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="text-sm font-semibold text-slate-200">Stock Depletion Watchlist</h2>
          <p className="text-xs text-slate-400">Available qty vs min threshold</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.stockDepletion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="sku" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                <Bar dataKey="qty" name="Available" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                <Bar dataKey="min" name="Threshold" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="text-sm font-semibold text-slate-200">Checkout Activity & Confidence</h2>
          <p className="text-xs text-slate-400">Session totals (₹) across recent lanes</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.checkoutActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="session" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="text-sm font-semibold text-slate-200">Expiry Risk Windows</h2>
          <p className="text-xs text-slate-400">SKUs grouped by days until expiry</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.expiryBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="window" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                <Bar dataKey="count" name="SKUs" radius={[6, 6, 0, 0]}>
                  {metrics.expiryBuckets.map((_, index) => (
                    <Cell key={index} fill={index === 0 ? "#ef4444" : index === 1 ? "#f59e0b" : "#3b82f6"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="text-sm font-semibold text-slate-200">Dynamic Discount Activity</h2>
          <p className="text-xs text-slate-400">Recommended markdown % by SKU</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.discountActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="sku" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
                <Bar dataKey="discountPct" name="Discount %" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="text-sm font-semibold text-slate-200">Agent Tool Execution Distribution</h2>
          <p className="text-xs text-slate-400">Deterministic tools invoked across runs</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.agentDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={72}
                  label={({ name }) => name}
                >
                  {metrics.agentDistribution.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
      </div>

      {/* Recent Agent Actions & Recent Checkout Sessions */}
      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Activity className="h-4 w-4 text-cyan-400" />
              Recent Autonomous Agent Actions
            </h2>
            <Link href="/dashboard/timeline" className="text-xs text-cyan-400 hover:text-cyan-300">
              Full timeline →
            </Link>
          </div>
          <div className="space-y-2.5">
            {state.auditLogs.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-100">{log.summary}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {log.eventCategory} • {log.actorRole}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-500">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {formatRelativeTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <ScanBarcode className="h-4 w-4 text-emerald-400" />
              Active & Recent Checkout Sessions
            </h2>
            <Link href="/dashboard/checkout" className="text-xs text-cyan-400 hover:text-cyan-300">
              Checkout monitor →
            </Link>
          </div>
          <div className="space-y-2.5">
            {state.checkoutSessions.slice(0, 6).map((chk) => (
              <div
                key={chk.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2.5"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-100">
                    {chk.sessionCode} • {chk.cameraId}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {chk.cashierId} • Conf: {chk.visualConfidence}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-100">{formatINR(chk.totalAmount)}</p>
                  <StatusBadge
                    tone={chk.status === "completed" ? "green" : chk.status === "paused_review" ? "amber" : "blue"}
                    className="mt-1"
                  >
                    {chk.status}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

