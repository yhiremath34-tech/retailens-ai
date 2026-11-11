"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  FlaskConical,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  StepForward,
  XCircle,
} from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
import { canApproveSensitiveActions } from "@/lib/auth/rbac";
import {
  PanelCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { formatINR } from "@/lib/utils";
import { AgentRun, AgentToolExecution, CheckoutSession } from "@/types/retailens";

type ScenarioKey = "frictionless_checkout" | "shelf_stockout" | "checkout_anomaly";

const SCENARIOS: Array<{
  key: ScenarioKey;
  badge: string;
  title: string;
  desc: string;
  expected: string;
}> = [
  {
    key: "frictionless_checkout",
    badge: "SCENARIO A",
    title: "Frictionless Autonomous Checkout",
    desc: "Camera detects SKU-COF-001 -> Barcode & POS validated -> Atomic inventory deduction -> Simulated GST receipt -> Memory persisted.",
    expected: "Completes autonomously with zero human friction.",
  },
  {
    key: "shelf_stockout",
    badge: "SCENARIO B",
    title: "Shelf Stockout & Replenishment PO",
    desc: "CAM-04 detects low stock on SKU-OLV-088 -> Queries DB & depletion memory -> Checks supplier lead time -> Drafts PO -> Pauses for Manager Approval.",
    expected: "Agent drafts PO autonomously; waits for human sign-off to dispatch.",
  },
  {
    key: "checkout_anomaly",
    badge: "SCENARIO C",
    title: "Checkout Scan Anomaly Protection",
    desc: "CAM-CHK-02 detects mismatch (Milk vs Yogurt at 61.8% confidence) -> Blocks inventory mutation -> Creates dispute & review request.",
    expected: "Zero unauthorized inventory override occurs.",
  },
];

export default function DemoCenterPage() {
  const { session, refresh } = useStoreData();
  const { pushToast } = useToast();

  const [activeKey, setActiveKey] = useState<ScenarioKey | null>(null);
  const [runData, setRunData] = useState<AgentRun | null>(null);
  const [toolData, setToolData] = useState<AgentToolExecution[]>([]);
  const [receipt, setReceipt] = useState<CheckoutSession | null>(null);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);

  const [visibleCount, setVisibleCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<0.5 | 1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalSteps = runData?.steps.length ?? 0;

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!runData || paused || visibleCount >= totalSteps) return;

    const delayMs = Math.round(950 / speed);
    timerRef.current = setTimeout(() => {
      setVisibleCount((c) => Math.min(totalSteps, c + 1));
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [runData, paused, visibleCount, totalSteps, speed]);

  async function launchScenario(key: ScenarioKey) {
    setLoading(true);
    setActiveKey(key);
    setPaused(false);
    setVisibleCount(0);
    setReceipt(null);
    setPendingApprovalId(null);

    try {
      const res = await fetch("/api/demo/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scenario failed");

      setRunData(data.run);
      setToolData(data.toolExecutions ?? []);
      setReceipt(data.receiptSession ?? null);
      setPendingApprovalId(data.approvalRequestId ?? null);
      setVisibleCount(1);
      await refresh();

      pushToast({
        kind: "info",
        title: `Executed ${key.replace("_", " ")}`,
        message: "Live database state updated; replaying trace.",
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Scenario error",
        message: err instanceof Error ? err.message : "Failed",
      });
    } finally {
      setLoading(false);
    }
  }

  async function resetDemoStore() {
    setLoading(true);
    try {
      const res = await fetch("/api/demo/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: "reset" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setRunData(null);
      setToolData([]);
      setReceipt(null);
      setPendingApprovalId(null);
      setVisibleCount(0);
      await refresh();
      pushToast({
        kind: "success",
        title: "Demo Store Reset",
        message: "Restored Retail Demo Market – Store 01 to initial baseline.",
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Reset failed",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setLoading(false);
    }
  }

  async function decidePending(decision: "approved" | "rejected") {
    if (!pendingApprovalId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/approvals/${pendingApprovalId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: `Decided live inside Hackathon Demo Control Center`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      setPendingApprovalId(null);
      await refresh();
      pushToast({
        kind: decision === "approved" ? "success" : "warning",
        title: `Manager ${decision} action`,
        message: "Audit log, memory, and store inventory/PO state updated.",
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Approval blocked",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Hackathon Demo Control Center"
        subtitle="Execute end-to-end live scenarios that mutate real database records, invoke validated tools, persist memory, and pause for human approval."
        actions={
          <SecondaryButton type="button" onClick={resetDemoStore} disabled={loading}>
            <RotateCcw className="h-4 w-4" />
            Reset Demo Store
          </SecondaryButton>
        }
      />

      {/* 3 Scenario Launcher Cards */}
      <div className="grid gap-5 lg:grid-cols-3">
        {SCENARIOS.map((sc) => (
          <PanelCard
            key={sc.key}
            className={`flex flex-col justify-between space-y-4 ${
              activeKey === sc.key ? "border-sky-400 bg-sky-50/70" : ""
            }`}
          >
            <div className="space-y-2">
              <StatusBadge tone="blue">{sc.badge}</StatusBadge>
              <h2 className="text-base font-bold text-slate-950">{sc.title}</h2>
              <p className="text-xs leading-relaxed text-slate-700">{sc.desc}</p>
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900">
                <strong>Expected Result:</strong> {sc.expected}
              </p>
            </div>
            <PrimaryButton
              type="button"
              disabled={loading}
              onClick={() => launchScenario(sc.key)}
              className="w-full"
            >
              <FlaskConical className="h-4 w-4" />
              Run {sc.badge}
            </PrimaryButton>
          </PanelCard>
        ))}
      </div>

      {/* Playback Controls & Live Trace */}
      {runData && (
        <PanelCard className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-950">{runData.objective}</h2>
              <p className="text-xs text-slate-600">
                Showing step {visibleCount} of {totalSteps} • {toolData.length} real backend tool calls persisted
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SecondaryButton
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="min-h-[34px] px-3 py-1 text-xs"
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {paused ? "Resume" : "Pause"}
              </SecondaryButton>
              <SecondaryButton
                type="button"
                onClick={() => {
                  setPaused(false);
                  setVisibleCount(1);
                }}
                className="min-h-[34px] px-3 py-1 text-xs"
              >
                <StepForward className="h-3.5 w-3.5" />
                Replay
              </SecondaryButton>

              <div className="flex items-center rounded-lg border border-sky-200 bg-sky-50/70 p-0.5 text-xs">
                {([0.5, 1, 2] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSpeed(s)}
                    className={`rounded-md px-2.5 py-1 font-mono ${
                      speed === s ? "bg-sky-300 font-semibold text-slate-950" : "text-slate-600 hover:text-slate-950"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step-by-Step Trace */}
          <div className="space-y-3">
            {runData.steps.slice(0, visibleCount).map((step, i) => (
              <div
                key={step.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-500">0{i + 1}</span>
                    <StatusBadge tone="cyan">{step.phase}</StatusBadge>
                    <span className="font-semibold text-slate-950">{step.title}</span>
                  </div>
                  <StatusBadge
                    tone={
                      step.status === "awaiting_approval"
                        ? "amber"
                        : step.status === "blocked"
                        ? "red"
                        : "green"
                    }
                  >
                    {step.status}
                  </StatusBadge>
                </div>
                <p className="mt-1.5 text-slate-700">{step.detail}</p>
              </div>
            ))}
          </div>

          {/* Scenario A Receipt Output */}
          {visibleCount >= totalSteps && receipt && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs">
              <p className="font-bold text-emerald-900">
                Simulated GST Receipt Generated: {receipt.sessionCode} • Total{" "}
                {formatINR(receipt.totalAmount)}
              </p>
              <p className="mt-1 text-emerald-800">
                Inventory deducted autonomously. View receipt details in{" "}
                <Link href="/dashboard/checkout" className="font-semibold text-sky-700 underline">
                  Checkout Monitor
                </Link>
                .
              </p>
            </div>
          )}

          {/* Scenario B/C Inline Human Approval Gate */}
          {visibleCount >= totalSteps && pendingApprovalId && (
            <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs">
              <div className="flex items-center gap-2 text-amber-900">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <strong>Human-in-the-Loop Gate Active:</strong>
                <span>
                  Execution paused pending authorized Store Manager approval ({pendingApprovalId.slice(0, 8)}).
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {session && canApproveSensitiveActions(session.role) ? (
                  <>
                    <PrimaryButton
                      type="button"
                      disabled={loading}
                      onClick={() => decidePending("approved")}
                      className="text-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve & Execute Now
                    </PrimaryButton>
                    <SecondaryButton
                      type="button"
                      disabled={loading}
                      onClick={() => decidePending("rejected")}
                      className="border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject Action
                    </SecondaryButton>
                  </>
                ) : (
                  <Link href="/dashboard/approvals">
                    <SecondaryButton type="button" className="text-xs">
                      Open Approval Center (Requires Manager Role)
                    </SecondaryButton>
                  </Link>
                )}
              </div>
            </div>
          )}
        </PanelCard>
      )}
    </div>
  );
}

