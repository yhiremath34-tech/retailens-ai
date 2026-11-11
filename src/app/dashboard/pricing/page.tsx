"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, ShieldCheck, Tag } from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
import {
  PanelCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { daysUntilDate, formatINR } from "@/lib/utils";

export default function DynamicPricingPage() {
  const { state, refresh } = useStoreData();
  const { pushToast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const expiringProducts = useMemo(() => {
    if (!state) return [];
    return state.products
      .filter((p) => daysUntilDate(p.expiryDate) <= state.pricingRules.expiryAlertWindowDays)
      .sort((a, b) => daysUntilDate(a.expiryDate) - daysUntilDate(b.expiryDate));
  }, [state]);

  async function runPricingScan() {
    setScanning(true);
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pricing scan failed");
      await refresh();
      const count = data.result?.recommendations?.length ?? 0;
      pushToast({
        kind: "success",
        title: `Expiry Pricing Scan Complete`,
        message: `Generated ${count} margin-protected recommendations.`,
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Scan failed",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setScanning(false);
    }
  }

  async function applyRecommendation(recId: string) {
    setApplyingId(recId);
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", recommendationId: recId }),
      });
      const data = await res.json();
      if (res.status === 202 || data.requiresApproval) {
        await refresh();
        pushToast({
          kind: "warning",
          title: "Escalated to Approval Center",
          message: data.message,
        });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Apply failed");
      await refresh();
      pushToast({
        kind: "success",
        title: "Dynamic Price Applied",
        message: `Updated store price to ${formatINR(data.appliedPrice)}.`,
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Pricing action failed",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dynamic Pricing Engine"
        subtitle="Expiry-aware markdown intelligence bounded by configured store minimum-margin and autonomous discount governance rules."
        actions={
          <PrimaryButton type="button" onClick={runPricingScan} disabled={scanning}>
            <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Evaluating Expiry Rules..." : "Run Expiry Pricing Scan"}
          </PrimaryButton>
        }
      />

      {/* Policy Guardrail Strip */}
      <PanelCard className="border-blue-500/25 bg-blue-950/20 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-200">
            <span>
              Min Gross Margin Floor: <strong className="text-cyan-300">{state?.pricingRules.minMarginPct ?? 10}%</strong>
            </span>
            <span>
              Autonomous Max Discount: <strong className="text-cyan-300">{state?.pricingRules.autoApproveMaxDiscountPct ?? 15}%</strong>
            </span>
            <span>
              Expiry Alert Window: <strong className="text-amber-300">{state?.pricingRules.expiryAlertWindowDays ?? 10} days</strong>
            </span>
          </div>
          <Link href="/dashboard/settings" className="text-cyan-400 hover:text-cyan-300">
            Configure Rules →
          </Link>
        </div>
      </PanelCard>

      {/* Recommendations Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(state?.priceRecommendations ?? []).map((rec) => (
          <PanelCard key={rec.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-cyan-400" />
                <span className="font-mono text-xs font-bold text-cyan-300">{rec.sku}</span>
                <StatusBadge
                  tone={rec.expiryRisk === "critical" ? "red" : rec.expiryRisk === "high" ? "amber" : "blue"}
                >
                  {rec.expiryRisk} expiry risk
                </StatusBadge>
              </div>
              <StatusBadge
                tone={
                  rec.status === "applied"
                    ? "green"
                    : rec.status === "pending_approval"
                    ? "amber"
                    : "neutral"
                }
              >
                {rec.status.replace("_", " ")}
              </StatusBadge>
            </div>

            <h2 className="text-base font-bold text-white">{rec.productName}</h2>

            <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
              <div>
                <p className="text-slate-400">Current Price</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-slate-300 line-through">
                  {formatINR(rec.originalPrice)}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Suggested Price</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-emerald-400">
                  {formatINR(rec.recommendedPrice)}
                </p>
              </div>
              <div>
                <p className="text-slate-400">Markdown</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-amber-300">
                  -{rec.discountPct}%
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300">{rec.reason}</p>
            <p className="text-xs text-emerald-300">Expected Impact: {rec.expectedImpact}</p>

            <div className="flex items-center justify-between pt-2">
              {rec.requiresApproval ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                  <ShieldCheck className="h-3.5 w-3.5" /> Exceeds autonomous cap — requires manager approval
                </span>
              ) : (
                <span className="text-[11px] text-emerald-400">Within autonomous pricing policy</span>
              )}

              {rec.status !== "applied" && (
                <SecondaryButton
                  type="button"
                  disabled={applyingId === rec.id}
                  onClick={() => applyRecommendation(rec.id)}
                  className="min-h-[34px] px-3 py-1 text-xs"
                >
                  {applyingId === rec.id
                    ? "Processing..."
                    : rec.requiresApproval
                    ? "Apply / Route to Approval"
                    : "Apply Discount"}
                </SecondaryButton>
              )}
            </div>
          </PanelCard>
        ))}
      </div>

      {/* Expiring Watchlist */}
      <PanelCard>
        <h2 className="mb-3 text-sm font-semibold text-white">
          Approaching-Expiry Inventory Watchlist ({expiringProducts.length} SKUs)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {expiringProducts.map((p) => {
            const days = daysUntilDate(p.expiryDate);
            return (
              <div key={p.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-cyan-300">{p.sku}</span>
                  <StatusBadge tone={days <= 2 ? "red" : "amber"}>{days}d remaining</StatusBadge>
                </div>
                <p className="mt-1.5 font-semibold text-white">{p.name}</p>
                <p className="mt-1 text-slate-400">
                  Stock: {p.availableQuantity} • Price: {formatINR(p.sellingPrice)} • Cost: {formatINR(p.costPrice)}
                </p>
              </div>
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
}

