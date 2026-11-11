"use client";

import React, { useMemo, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
import {
  PanelCard,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";

export default function EventTimelinePage() {
  const { state, refresh } = useStoreData();
  const [filter, setFilter] = useState("all");

  const timeline = useMemo(() => {
    if (!state) return [];
    const items = [
      ...state.visionEvents.map((v) => ({
        id: `vis-${v.id}`,
        timestamp: v.createdAt,
        source: "VISION",
        title: `${v.cameraId} — ${v.eventType.replace(/_/g, " ")} (${v.sku ?? "Frame"})`,
        detail: `${v.notes || ""} Confidence ${v.confidencePct}%`,
        tone: v.anomalyFlag ? ("amber" as const) : ("cyan" as const),
      })),
      ...state.agentToolExecutions.map((t) => ({
        id: `tool-${t.id}`,
        timestamp: t.createdAt,
        source: "AGENT_TOOL",
        title: `Tool ${t.toolName} → ${t.executionStatus}`,
        detail: JSON.stringify(t.result ?? t.inputArgs).slice(0, 180),
        tone:
          t.executionStatus === "executed"
            ? ("green" as const)
            : t.executionStatus === "awaiting_approval"
            ? ("amber" as const)
            : ("red" as const),
      })),
      ...state.auditLogs.map((a) => ({
        id: `aud-${a.id}`,
        timestamp: a.createdAt,
        source: "AUDIT",
        title: a.summary,
        detail: `Actor: ${a.actorRole} • Action: ${a.action}`,
        tone: a.eventCategory === "approval" ? ("blue" as const) : ("neutral" as const),
      })),
    ];

    return items
      .filter((it) => filter === "all" || it.source === filter)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 45);
  }, [state, filter]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Real-Time Operational Event Timeline"
        subtitle="Chronological stream generated directly from persisted computer vision detections, agent tool executions, memory writes, and manager approvals."
        actions={
          <SecondaryButton type="button" onClick={() => refresh()}>
            <RefreshCw className="h-4 w-4" />
            Refresh Stream
          </SecondaryButton>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "All Events" },
          { id: "VISION", label: "Vision Detections" },
          { id: "AGENT_TOOL", label: "Agent Tool Calls" },
          { id: "AUDIT", label: "Audit & Approvals" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f.id
                ? "bg-blue-600 text-white"
                : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <PanelCard>
        <div className="space-y-3">
          {timeline.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-col gap-1.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 text-xs sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  <StatusBadge tone={ev.tone}>{ev.source}</StatusBadge>
                  <span className="font-semibold text-white">{ev.title}</span>
                </div>
                <p className="text-slate-400">{ev.detail}</p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-slate-500">
                {new Date(ev.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}

