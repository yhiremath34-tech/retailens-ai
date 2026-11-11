"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, ShieldAlert } from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
import {
  PanelCard,
  PrimaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { formatINR, formatRelativeTime } from "@/lib/utils";

export default function PurchaseOrdersPage() {
  const { state, refresh } = useStoreData();
  const { pushToast } = useToast();

  const [sku, setSku] = useState("SKU-OLV-088");
  const [quantity, setQuantity] = useState("36");
  const [reason, setReason] = useState("Replenish low shelf inventory before weekend demand surge");
  const [submitting, setSubmitting] = useState(false);

  async function draftPo(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, quantity: Number(quantity), reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to draft PO");
      await refresh();
      pushToast({
        kind: "warning",
        title: `Drafted ${data.result.poNumber}`,
        message: "Queued in Approval Center — dispatch requires authorized Manager sign-off.",
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "PO draft error",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Supplier Purchase Orders"
        subtitle="Autonomous PO drafting with explicit human-in-the-loop authorization required before dispatching to vendors."
        actions={
          <Link href="/dashboard/approvals">
            <StatusBadge tone="amber" className="cursor-pointer px-3 py-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Review Pending PO Approvals
            </StatusBadge>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Plus className="h-4 w-4 text-sky-600" />
            Draft Replenishment Purchase Order
          </h2>
          <form onSubmit={draftPo} className="mt-4 space-y-3 text-xs">
            <div>
              <label htmlFor="po-sku" className="mb-1 block text-slate-700">Product SKU</label>
              <select
                id="po-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"
              >
                {(state?.products ?? []).map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.sku} — {p.name} (Stock: {p.availableQuantity})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="po-qty" className="mb-1 block text-slate-700">Order Quantity</label>
              <input
                id="po-qty"
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="po-reason" className="mb-1 block text-slate-700">Justification</label>
              <textarea
                id="po-reason"
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900"
              />
            </div>
            <PrimaryButton type="submit" disabled={submitting} className="w-full">
              <ClipboardList className="h-4 w-4" />
              {submitting ? "Generating PO Draft..." : "Generate PO Draft & Request Approval"}
            </PrimaryButton>
          </form>
        </PanelCard>

        <PanelCard className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-slate-950">Purchase Order Ledger</h2>
          <div className="space-y-3">
            {(state?.purchaseOrders ?? []).map((po) => (
              <div
                key={po.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-sky-700">{po.poNumber}</span>
                    <StatusBadge
                      tone={
                        po.status === "dispatched" || po.status === "approved"
                          ? "green"
                          : po.status === "pending_approval"
                          ? "amber"
                          : po.status === "rejected"
                          ? "red"
                          : "blue"
                      }
                    >
                      {po.status.replace("_", " ")}
                    </StatusBadge>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-950">
                    {formatINR(po.totalValue)}
                  </span>
                </div>
                <p className="mt-1.5 font-medium text-slate-800">
                  Supplier: {po.supplierName} • Est Lead Time: {po.estimatedLeadTimeDays} days
                </p>
                <p className="mt-1 text-slate-600">{po.reason}</p>
                <div className="mt-2.5 space-y-1 border-t border-slate-200 pt-2">
                  {po.items.map((it) => (
                    <div key={it.id} className="flex justify-between text-slate-700">
                      <span>
                        {it.sku} — {it.productName} (×{it.orderedQuantity})
                      </span>
                      <span className="font-mono font-medium">{formatINR(it.lineTotal)}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Created by {po.createdBy} {formatRelativeTime(po.createdAt)}
                  {po.approvedBy ? ` • Approved by ${po.approvedBy}` : ""}
                </p>
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </div>
  );
}

