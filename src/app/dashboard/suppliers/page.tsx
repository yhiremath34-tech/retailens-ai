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
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-950">{sup.name}</h2>
                      <p className="text-xs text-slate-500">{sup.contactName}</p>
                    </div>
                  </div>
                  <StatusBadge tone="green">{sup.status}</StatusBadge>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center text-xs">
                  <div>
                    <p className="text-[11px] text-slate-500">Lead Time</p>
                    <p className="font-mono font-bold text-slate-950">{sup.avgLeadTimeDays}d</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">MOQ</p>
                    <p className="font-mono font-bold text-slate-950">{sup.minOrderQuantity}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">Fulfillment</p>
                    <p className="font-mono font-bold text-emerald-700">{sup.fulfillmentRatePct}%</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-700">
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-500" /> {sup.contactEmail}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-500" /> {sup.contactPhone}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xs">
                <span className="text-slate-600">
                  {suppliedProducts.length} SKUs{" "}
                  {lowCount > 0 && <strong className="text-amber-700">({lowCount} low/out)</strong>}
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
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="flex items-center gap-1.5 text-slate-700">
                <Building2 className="h-4 w-4 text-sky-600" />
                Interface Mode:
              </span>
              <StatusBadge tone="amber">
                {selectedSupplier.apiEndpointStatus === "mock_interface"
                  ? "Simulated Vendor API Hook"
                  : "Connected EDI"}
              </StatusBadge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-700">
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
              <h3 className="mb-2 font-semibold text-slate-950">Supplied Store SKUs</h3>
              <div className="max-h-56 space-y-2 overflow-y-auto">
                {(state?.products ?? [])
                  .filter((p) => p.primarySupplierId === selectedSupplier.id)
                  .map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{p.name}</p>
                        <p className="font-mono text-[11px] text-sky-700">{p.sku}</p>
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

