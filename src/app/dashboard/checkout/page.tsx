"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { AlertOctagon, CheckCircle2, FileText, Play, ScanBarcode } from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
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
import { CheckoutSession } from "@/types/retailens";

export default function CheckoutMonitorPage() {
  const { state, refresh } = useStoreData();
  const { pushToast } = useToast();

  const [selectedSku, setSelectedSku] = useState("SKU-COF-001");
  const [qty, setQty] = useState("1");
  const [confidence, setConfidence] = useState("97.2");
  const [simulateMismatch, setSimulateMismatch] = useState(false);
  const [gstRate, setGstRate] = useState("18");
  const [submitting, setSubmitting] = useState(false);
  const [invoiceSession, setInvoiceSession] = useState<CheckoutSession | null>(null);

  const selectedProduct = useMemo(
    () => state?.products.find((p) => p.sku === selectedSku) ?? state?.products[0],
    [state, selectedSku]
  );

  async function processCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    try {
      const confVal = simulateMismatch ? 61.5 : Number(confidence);
      const posPrice = simulateMismatch ? 85 : selectedProduct.sellingPrice;
      const scannedBarcode = simulateMismatch ? "8901425001028" : selectedProduct.barcode;

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cameraId: simulateMismatch ? "CAM-CHK-02" : "CAM-CHK-01",
          gstRatePct: Number(gstRate),
          items: [
            {
              sku: selectedProduct.sku,
              quantity: Number(qty),
              posPrice,
              scannedBarcode,
              visualConfidence: confVal,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");

      await refresh();
      if (data.inventoryMutated) {
        setInvoiceSession(data.session);
        pushToast({
          kind: "success",
          title: `Checkout ${data.session.sessionCode} Verified`,
          message: "Inventory deducted atomically and simulated GST receipt generated.",
        });
      } else {
        pushToast({
          kind: "warning",
          title: `Checkout ${data.session.sessionCode} Paused`,
          message: "Low confidence / mismatch detected. Sent to Approval Center without mutating stock.",
        });
      }
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Checkout error",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Intelligent Checkout Monitor"
        subtitle="Cross-verifies POS barcode scans with overhead computer vision confidence. Pauses inventory mutations on discrepancies or <80% confidence."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Checkout Verification Simulator */}
        <PanelCard>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ScanBarcode className="h-4 w-4 text-sky-600" />
            Process / Verify Checkout Lane Event
          </h2>
          <form onSubmit={processCheckout} className="mt-4 space-y-3 text-xs">
            <div>
              <label htmlFor="chk-sku" className="mb-1 block text-slate-700">Product</label>
              <select
                id="chk-sku"
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 focus:border-sky-500 focus:outline-none"
              >
                {(state?.products ?? []).map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.sku} — {p.name} ({formatINR(p.sellingPrice)}, qty {p.availableQuantity})
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-1">
                  <Image
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    fill
                    className="object-contain p-0.5"
                    sizes="48px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-950">{selectedProduct.name}</p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {selectedProduct.sku} • Barcode {selectedProduct.barcode}
                  </p>
                  <p className="text-[11px] text-sky-700">
                    {formatINR(selectedProduct.sellingPrice)} • Stock: {selectedProduct.availableQuantity} units
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label htmlFor="chk-qty" className="mb-1 block text-slate-700">Qty</label>
                <input
                  id="chk-qty"
                  type="number"
                  min="1"
                  max="10"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="chk-conf" className="mb-1 block text-slate-700">Vision %</label>
                <input
                  id="chk-conf"
                  type="number"
                  step="0.1"
                  min="10"
                  max="100"
                  disabled={simulateMismatch}
                  value={simulateMismatch ? "61.5" : confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-slate-900 focus:border-sky-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
              <div>
                <label htmlFor="chk-gst" className="mb-1 block text-slate-700">GST %</label>
                <input
                  id="chk-gst"
                  type="number"
                  step="0.5"
                  min="0"
                  max="28"
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-900">
              <input
                type="checkbox"
                checked={simulateMismatch}
                onChange={(e) => setSimulateMismatch(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span>Simulate Barcode/Price Mismatch & Low Confidence</span>
            </label>

            <PrimaryButton type="submit" disabled={submitting} className="w-full">
              <Play className="h-4 w-4" />
              {submitting ? "Verifying Scan..." : "Run Checkout Verification"}
            </PrimaryButton>
          </form>
        </PanelCard>

        {/* Active Disputes */}
        <PanelCard className="lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <AlertOctagon className="h-4 w-4 text-amber-600" />
            Checkout Anomaly & Review Queue
          </h2>
          <div className="space-y-3">
            {(state?.checkoutDisputes ?? []).map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-800">{d.sessionCode}</span>
                    <StatusBadge tone={d.status === "pending_approval" ? "amber" : "green"}>
                      {d.status}
                    </StatusBadge>
                    <StatusBadge tone="red">{d.disputeType}</StatusBadge>
                  </div>
                  <span className="text-slate-500">{formatRelativeTime(d.createdAt)}</span>
                </div>
                <p className="mt-2 text-slate-700">{d.description}</p>
                {d.resolvedBy && (
                  <p className="mt-1.5 text-[11px] text-emerald-700">
                    Resolved by {d.resolvedBy}: {d.resolutionNotes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </PanelCard>
      </div>

      {/* Checkout Sessions Table */}
      <PanelCard>
        <h2 id="chk-table-title" className="mb-4 text-sm font-semibold text-slate-950">
          Checkout Sessions & POS Item Verification Log
        </h2>
        <div tabIndex={0} role="region" aria-labelledby="chk-table-title" className="table-wrapper">
          <table className="retail-table retail-table-responsive text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2.5">Checkout ID</th>
                <th className="px-3 py-2.5">Cashier / Lane</th>
                <th className="px-3 py-2.5">Scanned Items</th>
                <th className="px-3 py-2.5">Expected vs POS</th>
                <th className="px-3 py-2.5">Vision Conf</th>
                <th className="px-3 py-2.5">Total (Incl. GST)</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(state?.checkoutSessions ?? []).map((chk) => {
                const first = chk.items[0];
                const firstProduct = (state?.products ?? []).find((p) => p.sku === first?.sku);
                return (
                  <tr key={chk.id} className="hover:bg-sky-50/40">
                    <th className="px-3 py-3 font-mono font-semibold text-sky-700">
                      {chk.sessionCode}
                    </th>
                    <td data-label="Cashier" className="px-3 py-3 text-slate-700">
                      <p>{chk.cashierId}</p>
                      <p className="text-[11px] text-slate-500">{chk.cameraId}</p>
                    </td>
                    <td data-label="Items" className="px-3 py-3 text-slate-800">
                      <div className="flex items-center gap-2.5">
                        {firstProduct && (
                          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                            <Image
                              src={firstProduct.imageUrl}
                              alt={firstProduct.name}
                              fill
                              className="object-contain p-0.5"
                              sizes="32px"
                            />
                          </div>
                        )}
                        <span>
                          {chk.items.map((it) => `${it.sku} (×${it.quantity})`).join(", ")}
                        </span>
                      </div>
                    </td>
                    <td data-label="Price Check" className="px-3 py-3 font-mono text-slate-700">
                      {first
                        ? `${formatINR(first.expectedPrice)} / ${formatINR(first.posPrice)}`
                        : "—"}
                    </td>
                    <td data-label="Vision Conf" className="px-3 py-3 font-mono font-semibold">
                      <span className={chk.visualConfidence < 80 ? "text-amber-700" : "text-emerald-700"}>
                        {chk.visualConfidence}%
                      </span>
                    </td>
                    <td data-label="Total" className="px-3 py-3 font-semibold text-slate-950">
                      {formatINR(chk.totalAmount)}
                    </td>
                    <td data-label="Status" className="px-3 py-3">
                      <StatusBadge
                        tone={chk.status === "completed" ? "green" : chk.status === "paused_review" ? "amber" : "blue"}
                      >
                        {chk.status}
                      </StatusBadge>
                    </td>
                    <td data-label="Invoice" className="px-3 py-3 text-right">
                      <SecondaryButton
                        type="button"
                        onClick={() => setInvoiceSession(chk)}
                        className="min-h-[32px] px-2.5 py-1 text-xs"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        GST Preview
                      </SecondaryButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {/* Simulated GST Invoice Modal */}
      <ModalDialog
        open={Boolean(invoiceSession)}
        onClose={() => setInvoiceSession(null)}
        title={`Simulated GST Invoice Preview • ${invoiceSession?.sessionCode ?? ""}`}
      >
        {invoiceSession && (
          <div className="space-y-4 text-xs">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-center font-semibold text-amber-900">
              SIMULATED DEMO INVOICE — NOT A LEGALLY ISSUED GST TAX INVOICE
            </div>

            <div className="flex justify-between border-b border-slate-200 pb-3">
              <div>
                <p className="font-bold text-slate-950">{state?.store.name}</p>
                <p className="text-slate-600">{state?.store.location}</p>
                <p className="font-mono text-slate-500">DEMO-GSTIN: 29SYNTHETIC01Z5</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-semibold text-sky-700">{invoiceSession.sessionCode}</p>
                <p className="text-slate-500">{new Date(invoiceSession.createdAt).toLocaleString()}</p>
              </div>
            </div>

            <div className="space-y-2 border-b border-slate-200 pb-3">
              {invoiceSession.items.map((it) => {
                const prod = (state?.products ?? []).find((p) => p.sku === it.sku);
                return (
                  <div key={it.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {prod && (
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-slate-200 bg-white">
                          <Image
                            src={prod.imageUrl}
                            alt={it.productName}
                            fill
                            className="object-contain p-0.5"
                            sizes="32px"
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-950">
                          {it.productName} ({it.sku})
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Barcode: {it.scannedBarcode} • Qty: {it.quantity} × {formatINR(it.posPrice)}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-slate-950">
                      {formatINR(it.posPrice * it.quantity)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1 text-right">
              <p className="text-slate-600">Subtotal: {formatINR(invoiceSession.subtotal)}</p>
              <p className="text-slate-600">
                CGST + SGST: {formatINR(invoiceSession.gstAmount)}
              </p>
              <p className="text-base font-bold text-slate-950">
                Grand Total: {formatINR(invoiceSession.totalAmount)}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                CV Confidence: {invoiceSession.visualConfidence}%
              </span>
              <SecondaryButton type="button" onClick={() => window.print()}>
                Print Preview
              </SecondaryButton>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}

