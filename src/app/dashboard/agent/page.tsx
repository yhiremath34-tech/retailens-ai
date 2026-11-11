"use client";

import React, { useState } from "react";
import { Bot, CheckCircle2, Play, ShieldAlert, Wrench } from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
import {
  PanelCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { formatRelativeTime } from "@/lib/utils";

const OBJECTIVE_PRESETS = [
  "Investigate low shelf stock on SKU-OLV-088, retrieve supplier memory, and prepare replenishment PO",
  "Scan approaching-expiry dairy and bakery products and calculate margin-safe dynamic discounts",
  "Verify checkout anomaly on Lane 02 (SKU-MLK-002 vs SKU-YOG-006 at 62% confidence)",
  "Run full store autonomous health sweep across inventory, expiry risk, and approval backlog",
];

export default function AgentWorkspacePage() {
  const { state, modes, refresh } = useStoreData();
  const { pushToast } = useToast();

  const [objective, setObjective] = useState(OBJECTIVE_PRESETS[0]);
  const [running, setRunning] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const activeRun =
    state?.agentRuns.find((r) => r.id === selectedRunId) ?? state?.agentRuns[0] ?? null;

  const toolExecutionsForRun = (state?.agentToolExecutions ?? []).filter(
    (t) => t.agentRunId === activeRun?.id
  );

  async function executeAgentRun(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    setRunning(true);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, triggerSource: "agent_workspace" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent run failed");

      setSelectedRunId(data.run.id);
      await refresh();
      pushToast({
        kind: data.run.status === "awaiting_approval" ? "warning" : "success",
        title: `Agent Run ${data.run.status === "awaiting_approval" ? "Awaiting Approval" : "Completed"}`,
        message: `${data.toolExecutions.length} validated tool calls executed.`,
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Agent error",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Autonomous AI Agent Workspace"
        subtitle="Genuine ReAct orchestration loop (PERCEIVE → REASON → PLAN → ACT → OBSERVE → REMEMBER) with Zod-validated deterministic tools and server-enforced approval gates."
        actions={
          <StatusBadge tone={modes?.aiPlannerMode === "gemini" ? "blue" : "cyan"}>
            Planner: {modes?.aiPlannerMode === "gemini" ? "Gemini Structured Tool Calling" : "Deterministic ReAct Engine"}
          </StatusBadge>
        }
      />

      {/* Objective Dispatch Form */}
      <PanelCard>
        <form onSubmit={executeAgentRun} className="space-y-3">
          <label htmlFor="agent-obj" className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Operational Objective
          </label>
          <div className="flex flex-wrap gap-2">
            {OBJECTIVE_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setObjective(preset)}
                className="rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-left text-[11px] font-medium text-sky-950 transition hover:border-sky-300 hover:bg-sky-100"
              >
                Preset {idx + 1}: {preset.slice(0, 56)}...
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="agent-obj"
              type="text"
              required
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="min-h-[44px] flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
            />
            <PrimaryButton type="submit" disabled={running} className="shrink-0">
              <Play className="h-4 w-4" />
              {running ? "Running ReAct Loop..." : "Execute Autonomous Agent"}
            </PrimaryButton>
          </div>
        </form>
      </PanelCard>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Run History Selector */}
        <PanelCard className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-950">Recent Agent Runs</h2>
          <div className="max-h-[460px] space-y-2 overflow-y-auto">
            {(state?.agentRuns ?? []).map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedRunId(run.id)}
                className={`w-full rounded-xl border p-3 text-left text-xs transition ${
                  activeRun?.id === run.id
                    ? "border-sky-400 bg-sky-100/80 text-slate-950"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge
                    tone={
                      run.status === "completed"
                        ? "green"
                        : run.status === "awaiting_approval"
                        ? "amber"
                        : "blue"
                    }
                  >
                    {run.status}
                  </StatusBadge>
                  <span className="text-[11px] text-slate-500">
                    {formatRelativeTime(run.createdAt)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 font-medium text-slate-950">{run.objective}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {run.plannedActions.length} tools • {run.plannerMode}
                </p>
              </button>
            ))}
          </div>
        </PanelCard>

        {/* Active ReAct Trace */}
        <PanelCard className="lg:col-span-2 space-y-5">
          {activeRun ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-sky-600" />
                    <span className="text-xs font-mono text-slate-500">RUN {activeRun.id.slice(0, 8)}</span>
                    <StatusBadge
                      tone={activeRun.status === "awaiting_approval" ? "amber" : "green"}
                    >
                      {activeRun.status}
                    </StatusBadge>
                  </div>
                  <h2 className="mt-1.5 text-base font-bold text-slate-950">{activeRun.objective}</h2>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Reasoning Summary
                </h3>
                <p className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                  {activeRun.reasoningSummary}
                </p>
              </div>

              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  PERCEIVE → REASON → PLAN → ACT → OBSERVE → REMEMBER Trace
                </h3>
                <div className="space-y-2.5">
                  {activeRun.steps.map((step) => (
                    <div
                      key={step.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-sky-200 bg-sky-100 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-900">
                            {step.phase}
                          </span>
                          <span className="font-semibold text-slate-950">{step.title}</span>
                        </div>
                        {step.status === "awaiting_approval" ? (
                          <StatusBadge tone="amber">
                            <ShieldAlert className="h-3 w-3" /> Approval Required
                          </StatusBadge>
                        ) : step.status === "blocked" ? (
                          <StatusBadge tone="red">Safety Blocked</StatusBadge>
                        ) : (
                          <StatusBadge tone="green">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </StatusBadge>
                        )}
                      </div>
                      <p className="mt-1.5 text-slate-600">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <Wrench className="h-3.5 w-3.5 text-sky-600" />
                  Validated Tool Executions ({toolExecutionsForRun.length})
                </h3>
                <div className="space-y-2">
                  {toolExecutionsForRun.map((te) => (
                    <details
                      key={te.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                    >
                      <summary className="flex cursor-pointer items-center justify-between font-mono font-semibold text-sky-700">
                        <span>{te.toolName}</span>
                        <StatusBadge
                          tone={
                            te.executionStatus === "executed"
                              ? "green"
                              : te.executionStatus === "awaiting_approval"
                              ? "amber"
                              : "red"
                          }
                        >
                          {te.executionStatus}
                        </StatusBadge>
                      </summary>
                      <div className="mt-2.5 space-y-2 border-t border-slate-200 pt-2 font-mono text-[11px] text-slate-700">
                        <p className="text-slate-500">Exec ID: {te.id}</p>
                        <pre className="overflow-x-auto rounded border border-slate-200 bg-white p-2 text-slate-800">
                          Input: {JSON.stringify(te.inputArgs, null, 2)}
                        </pre>
                        {te.result && (
                          <pre className="overflow-x-auto rounded border border-emerald-200 bg-emerald-50/70 p-2 text-emerald-900">
                            Output: {JSON.stringify(te.result, null, 2)}
                          </pre>
                        )}
                        {te.errorDetails && (
                          <p className="text-rose-700">Error: {te.errorDetails}</p>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              </div>

              {activeRun.finalSummary && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <strong>Final Summary:</strong> {activeRun.finalSummary}
                </div>
              )}
            </>
          ) : (
            <SecondaryButton type="button" onClick={refresh}>
              Load Agent Runs
            </SecondaryButton>
          )}
        </PanelCard>
      </div>
    </div>
  );
}

