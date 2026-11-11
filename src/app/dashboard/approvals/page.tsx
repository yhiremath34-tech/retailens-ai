"use client";

import React, { useState } from "react";
import { CheckCircle2, Eye, MessageSquareWarning, ShieldAlert, XCircle } from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
import { canApproveSensitiveActions, ROLE_LABELS } from "@/lib/auth/rbac";
import { ModalDialog } from "@/components/ui/ConfirmDialog";
import {
  PanelCard,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { formatINR, formatRelativeTime } from "@/lib/utils";
import { ApprovalRequest } from "@/types/retailens";

export default function ApprovalCenterPage() {
  const { state, session, refresh } = useStoreData();
  const { pushToast } = useToast();

  const [detailItem, setDetailItem] = useState<ApprovalRequest | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAuthorized = session ? canApproveSensitiveActions(session.role) : false;

  async function submitDecision(
    requestId: string,
    decision: "approved" | "rejected" | "changes_requested"
  ) {
    setBusyId(requestId);
    try {
      const res = await fetch(`/api/approvals/${requestId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, notes: notesById[requestId] || "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Decision failed");

      await refresh();
      pushToast({
        kind: decision === "approved" ? "success" : decision === "rejected" ? "warning" : "info",
        title: `Request ${decision.replace("_", " ")}`,
        message:
          decision === "approved"
            ? "Deterministic backend operation executed and audit logged."
            : "Original store state preserved and feedback stored in agent memory.",
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Authorization / Execution Error",
        message: err instanceof Error ? err.message : "Failed",
      });
    } finally {
      setBusyId(null);
    }
  }

  const pending = (state?.approvalRequests ?? []).filter((a) => a.status === "pending");
  const history = (state?.approvalRequests ?? []).filter((a) => a.status !== "pending");

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Human-in-the-Loop Approval Center"
        subtitle="AI agents never self-approve sensitive actions. High-value supplier POs, checkout overrides, and steep dynamic discounts pause here for authorized Store Manager sign-off."
      />

      {!isAuthorized && session && (
        <PanelCard className="border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                Read-Only Approval View ({ROLE_LABELS[session.role]})
              </p>
              <p className="mt-0.5 text-amber-800">
                Server-side RBAC enforces that only <strong>Store Owner</strong> or{" "}
                <strong>Store Manager</strong> roles can approve or reject sensitive operations.
                Attempting an API override with your current role will be rejected with 403 Forbidden.
              </p>
            </div>
          </div>
        </PanelCard>
      )}

      {/* Pending Approvals */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          Pending Authorizations ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <PanelCard className="text-center text-sm text-slate-500">
            All agent recommendations have been reviewed. Trigger Scenario B or C in Demo Center to
            generate new pending approvals.
          </PanelCard>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((req) => (
              <PanelCard key={req.id} className="space-y-4 border-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="amber">{req.actionType.replace(/_/g, " ")}</StatusBadge>
                    <StatusBadge
                      tone={req.riskLevel === "high" || req.riskLevel === "critical" ? "red" : "blue"}
                    >
                      {req.riskLevel} risk
                    </StatusBadge>
                    {req.sku && <StatusBadge tone="cyan">{req.sku}</StatusBadge>}
                  </div>
                  <span className="text-xs text-slate-500">{formatRelativeTime(req.createdAt)}</span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-950">{req.proposedChange}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {req.agentExplanation}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <span className="text-slate-600">Estimated Financial Impact:</span>
                  <span className="font-mono text-sm font-bold text-slate-950">
                    {formatINR(req.financialImpact)}
                  </span>
                </div>

                <div>
                  <label htmlFor={`notes-${req.id}`} className="mb-1 block text-[11px] text-slate-600">
                    Manager Decision Notes (optional)
                  </label>
                  <input
                    id={`notes-${req.id}`}
                    type="text"
                    placeholder="Add audit note or requested changes..."
                    value={notesById[req.id] || ""}
                    onChange={(e) => setNotesById({ ...notesById, [req.id]: e.target.value })}
                    className="min-h-[38px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <PrimaryButton
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => submitDecision(req.id, "approved")}
                    className="text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve & Execute
                  </PrimaryButton>
                  <button
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => submitDecision(req.id, "rejected")}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                  <SecondaryButton
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => submitDecision(req.id, "changes_requested")}
                    className="text-xs"
                  >
                    <MessageSquareWarning className="h-3.5 w-3.5" />
                    Request Changes
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => setDetailItem(req)}
                    className="text-xs"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Evidence
                  </SecondaryButton>
                </div>
              </PanelCard>
            ))}
          </div>
        )}
      </section>

      {/* Historical Decisions */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
            Completed Approval Decisions ({history.length})
          </h2>
          <div className="space-y-2.5">
            {history.map((req) => (
              <PanelCard key={req.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={req.status === "approved" ? "green" : "red"}>
                      {req.status}
                    </StatusBadge>
                    <span className="text-xs font-semibold text-slate-950">{req.proposedChange}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Impact: {formatINR(req.financialImpact)} • Updated {formatRelativeTime(req.updatedAt)}
                  </p>
                </div>
                <SecondaryButton type="button" onClick={() => setDetailItem(req)} className="text-xs">
                  Inspect Audit
                </SecondaryButton>
              </PanelCard>
            ))}
          </div>
        </section>
      )}

      {/* Evidence Detail Dialog */}
      <ModalDialog
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        title={`Approval Evidence • ${detailItem?.sku ?? detailItem?.actionType ?? ""}`}
      >
        {detailItem && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-700">{detailItem.agentExplanation}</p>
            <div>
              <p className="mb-1 font-semibold text-slate-600">Structured Verification Evidence:</p>
              <pre className="max-h-60 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-800">
                {JSON.stringify(detailItem.evidence, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}

