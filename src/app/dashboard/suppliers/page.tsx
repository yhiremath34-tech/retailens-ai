"use client";

import React, { useState } from "react";
import { Building2, Clock, Mail, Phone, Truck } from "lucide-react";
import { useStoreData } from "@/components/providers/StoreContext";
import { ModalDialog } from "@/components/ui/ConfirmDialog";
import {
  PanelCard,
  SecondaryButton,
  SectionHeader,
  StatusBadge,
} from "@/components/ui/primitives";
import { Supplier } from "@/types/retailens";

export default function SuppliersPage() {
  const { state } = useStoreData();
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Supplier Management"
        subtitle="Vendor lead times, minimum order quantities, historical fulfillment metrics, and EDI/API integration interfaces (Synthetic Demo Vendors)."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(state?.suppliers ?? []).map((sup) => {
          const suppliedProducts = (state?.products ?? []).filter(
            (p) => p.primarySupplierId === sup.id
          );
          const lowCount = suppliedProducts.filter(
            (p) => p.stockStatus !== "in_stock"
          ).length;

          return (
            <PanelCard key={sup.id} className="flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-cyan-300">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">{sup.name}</h2>
                      <p className="text-xs text-slate-400">{sup.contactName}</p>
                    </div>
                  </div>
                  <StatusBadge tone="green">{sup.status}</StatusBadge>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-center text-xs">
                  <div>
                    <p className="text-[11px] text-slate-400">Lead Time</p>
                    <p className="font-mono font-bold text-white">{sup.avgLeadTimeDays}d</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">MOQ</p>
                    <p className="font-mono font-bold text-white">{sup.minOrderQuantity}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400">Fulfillment</p>
                    <p className="font-mono font-bold text-emerald-400">{sup.fulfillmentRatePct}%</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-300">
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {sup.contactEmail}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {sup.contactPhone}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                <span className="text-slate-400">
                  {suppliedProducts.length} SKUs{" "}
                  {lowCount > 0 && <strong className="text-amber-300">({lowCount} low/out)</strong>}
                </span>
                <SecondaryButton
                  type="button"
                  onClick={() => setSelectedSupplier(sup)}
                  className="min-h-[32px] px-3 py-1 text-xs"
                >
                  View Details
                </SecondaryButton>
              </div>
            </PanelCard>
          );
        })}
      </div>

      {/* Supplier Detail Dialog */}
      <ModalDialog
        open={Boolean(selectedSupplier)}
        onClose={() => setSelectedSupplier(null)}
        title={selectedSupplier?.name ?? "Supplier Details"}
      >
        {selectedSupplier && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Building2 className="h-4 w-4 text-cyan-400" />
                Interface Mode:
              </span>
              <StatusBadge tone="amber">
                {selectedSupplier.apiEndpointStatus === "mock_interface"
                  ? "Simulated Vendor API Hook"
                  : "Connected EDI"}
              </StatusBadge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-300">
              <p>
                <span className="text-slate-500">Primary Contact:</span> {selectedSupplier.contactName}
              </p>
              <p>
                <span className="text-slate-500">Avg Lead Time:</span>{" "}
                <Clock className="mr-1 inline h-3 w-3" />
                {selectedSupplier.avgLeadTimeDays} days
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-white">Supplied Store SKUs</h3>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {(state?.products ?? [])
                  .filter((p) => p.primarySupplierId === selectedSupplier.id)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        <p className="font-mono text-[11px] text-cyan-300">{p.sku}</p>
                      </div>
                      <StatusBadge
                        tone={
                          p.stockStatus === "in_stock"
                            ? "green"
                            : p.stockStatus === "low_stock"
                            ? "amber"
                            : "red"
                        }
                      >
                        {p.availableQuantity} left
                      </StatusBadge>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}

