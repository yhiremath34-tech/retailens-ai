"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
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
      <PanelCard className="border-sky-200 bg-sky-50/70 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-700">
            <span>
              Min Gross Margin Floor: <strong className="text-sky-800">{state?.pricingRules.minMarginPct ?? 10}%</strong>
            </span>
            <span>
              Autonomous Max Discount: <strong className="text-sky-800">{state?.pricingRules.autoApproveMaxDiscountPct ?? 15}%</strong>
            </span>
            <span>
              Expiry Alert Window: <strong className="text-amber-800">{state?.pricingRules.expiryAlertWindowDays ?? 10} days</strong>
            </span>
          </div>
          <Link href="/dashboard/settings" className="font-medium text-sky-700 hover:text-sky-600">
            Configure Rules →
          </Link>
        </div>
      </PanelCard>

      {/* Recommendations Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {(state?.priceRecommendations ?? []).map((rec) => {
          const matchedProd = (state?.products ?? []).find((p) => p.sku === rec.sku);
          return (
            <PanelCard key={rec.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-sky-600" />
                  <span className="font-mono text-xs font-bold text-sky-700">{rec.sku}</span>
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

              <div className="flex items-center gap-3">
                {matchedProd && (
                  <Image
                    src={matchedProd.imageUrl}
                    alt={rec.productName}
                    width={52}
                    height={52}
                    unoptimized
                    className="h-13 w-13 shrink-0 rounded-xl border border-slate-200 bg-white p-0.5 object-contain"
                  />
                )}
                <h2 className="text-base font-bold text-slate-950">{rec.productName}</h2>
              </div>

              <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div>
                  <p className="text-slate-500">Current Price</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-slate-500 line-through">
                    {formatINR(rec.originalPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Suggested Price</p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-emerald-700">
                    {formatINR(rec.recommendedPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Markdown</p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-amber-700">
                    -{rec.discountPct}%
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-700">{rec.reason}</p>
              <p className="text-xs font-medium text-emerald-800">Expected Impact: {rec.expectedImpact}</p>

              <div className="flex items-center justify-between pt-2">
                {rec.requiresApproval ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                    <ShieldCheck className="h-3.5 w-3.5" /> Exceeds autonomous cap — requires manager approval
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-emerald-700">Within autonomous pricing policy</span>
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
          );
        })}
      </div>

      {/* Expiring Watchlist */}
      <PanelCard>
        <h2 className="mb-3 text-sm font-semibold text-slate-950">
          Approaching-Expiry Inventory Watchlist ({expiringProducts.length} SKUs)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {expiringProducts.map((p) => {
            const days = daysUntilDate(p.expiryDate);
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <Image
                  src={p.imageUrl}
                  alt={p.name}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 bg-white p-0.5 object-contain"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-sky-700">{p.sku}</span>
                    <StatusBadge tone={days <= 2 ? "red" : "amber"}>{days}d left</StatusBadge>
                  </div>
                  <p className="mt-1 truncate font-semibold text-slate-950">{p.name}</p>
                  <p className="mt-0.5 text-slate-600">
                    Stock: {p.availableQuantity} • {formatINR(p.sellingPrice)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </PanelCard>
    </div>
  );
}

