"use client";

import React, { useEffect, useState } from "react";
import { Database, RotateCcw, Save, ShieldCheck } from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
import {
  PanelCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";

export default function SettingsPage() {
  const { state, session, modes, refresh } = useStoreData();
  const { pushToast } = useToast();

  const [minMarginPct, setMinMarginPct] = useState("10");
  const [autoDiscountPct, setAutoDiscountPct] = useState("15");
  const [expiryWindow, setExpiryWindow] = useState("10");
  const [poLimit, setPoLimit] = useState("5000");
  const [gstRate, setGstRate] = useState("18");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!state) return;
    setMinMarginPct(String(state.pricingRules.minMarginPct));
    setAutoDiscountPct(String(state.pricingRules.autoApproveMaxDiscountPct));
    setExpiryWindow(String(state.pricingRules.expiryAlertWindowDays));
    setPoLimit(String(state.pricingRules.poAutoApproveLimit));
    setGstRate(String(state.store.gstRatePct));
  }, [state]);

  async function handleSaveRules(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minMarginPct: Number(minMarginPct),
          autoApproveMaxDiscountPct: Number(autoDiscountPct),
          expiryAlertWindowDays: Number(expiryWindow),
          poAutoApproveLimit: Number(poLimit),
          gstRatePct: Number(gstRate),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");
      await refresh();
      pushToast({ kind: "success", title: "Governance rules updated", message: "Persisted to store config." });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Save failed",
        message: err instanceof Error ? err.message : "Permission denied",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDemo() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_demo" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      await refresh();
      pushToast({ kind: "success", title: "Demo Store Restored", message: "All synthetic baseline records restored." });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Reset failed",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Store Settings & Governance"
        subtitle="Inspect active integration modes (Simulation vs Connected) and configure agent pricing floors, approval thresholds, and simulated GST tax rates."
      />

      {/* Transparent System Modes */}
      <PanelCard>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
          <Database className="h-4 w-4 text-sky-600" />
          Live Integration & Simulation Status
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-slate-600">Database Persistence</p>
            <StatusBadge tone={modes?.databaseMode === "supabase" ? "green" : "amber"} className="mt-2">
              {modes?.databaseMode === "supabase" ? "Supabase PostgreSQL" : "Local Persistent Simulation"}
            </StatusBadge>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-slate-600">Authentication Provider</p>
            <StatusBadge tone={modes?.authMode === "supabase" ? "green" : "amber"} className="mt-2">
              {modes?.authMode === "supabase" ? "Supabase Auth" : "Signed Cookie Simulation"}
            </StatusBadge>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-slate-600">AI Agent Planner</p>
            <StatusBadge tone={modes?.aiPlannerMode === "gemini" ? "blue" : "cyan"} className="mt-2">
              {modes?.aiPlannerMode === "gemini" ? "Gemini Tool Calling" : "Deterministic ReAct"}
            </StatusBadge>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-slate-600">Computer Vision Service</p>
            <StatusBadge tone={modes?.visionMode === "fastapi_opencv" ? "green" : "amber"} className="mt-2">
              {modes?.visionMode === "fastapi_opencv" ? "FastAPI OpenCV Online" : "CV Simulation Fallback"}
            </StatusBadge>
          </div>
        </div>
      </PanelCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Governance Form */}
        <PanelCard>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Pricing & Approval Policy Guardrails
          </h2>
          <form onSubmit={handleSaveRules} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="s-margin" className="mb-1 block text-slate-700">Min Gross Margin Floor (%)</label>
                <input
                  id="s-margin"
                  type="number"
                  step="0.5"
                  value={minMarginPct}
                  onChange={(e) => setMinMarginPct(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="s-disc" className="mb-1 block text-slate-700">Auto-Approve Max Discount (%)</label>
                <input
                  id="s-disc"
                  type="number"
                  step="0.5"
                  value={autoDiscountPct}
                  onChange={(e) => setAutoDiscountPct(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="s-exp" className="mb-1 block text-slate-700">Expiry Alert (Days)</label>
                <input
                  id="s-exp"
                  type="number"
                  value={expiryWindow}
                  onChange={(e) => setExpiryWindow(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="s-po" className="mb-1 block text-slate-700">PO Approval Cap (₹)</label>
                <input
                  id="s-po"
                  type="number"
                  value={poLimit}
                  onChange={(e) => setPoLimit(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="s-gst" className="mb-1 block text-slate-700">Demo GST Rate (%)</label>
                <input
                  id="s-gst"
                  type="number"
                  step="0.5"
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"
                />
              </div>
            </div>

            <PrimaryButton type="submit" disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving Rules..." : "Save Governance Rules"}
            </PrimaryButton>
          </form>
        </PanelCard>

        {/* Session & Reset Card */}
        <PanelCard className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-950">Active Session & Demo Reset</h2>
          <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="text-slate-700">
              Signed in as: <strong className="text-slate-950">{session?.fullName}</strong> ({session?.email})
            </p>
            <p className="text-slate-600">Role: {session?.role}</p>
            <p className="text-slate-600">Store: {state?.store.name}</p>
          </div>
          <p className="text-xs text-slate-600">
            Resetting the demo store restores all 22 synthetic SKUs, 5 suppliers, historical checkout
            sessions, agent memory records, and pending approval cards back to clean baseline state.
          </p>
          <SecondaryButton type="button" onClick={handleResetDemo} disabled={saving}>
            <RotateCcw className="h-4 w-4" />
            Reset Synthetic Demo Database
          </SecondaryButton>
        </PanelCard>
      </div>
    </div>
  );
}

