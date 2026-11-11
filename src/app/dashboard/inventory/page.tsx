"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Download, Edit3, History, Plus, Search, Trash2 } from "lucide-react";
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
import { daysUntilDate, downloadCsv, formatINR, formatRelativeTime } from "@/lib/utils";
import { ProductWithInventory } from "@/types/retailens";

export default function InventoryPage() {
  const { state, refresh } = useStoreData();
  const { pushToast } = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [editingProd, setEditingProd] = useState<ProductWithInventory | null>(null);
  const [deleteProd, setDeleteProd] = useState<ProductWithInventory | null>(null);
  const [historyProd, setHistoryProd] = useState<ProductWithInventory | null>(null);
  const [busy, setBusy] = useState(false);

  const [formState, setFormState] = useState({
    sku: "",
    name: "",
    barcode: "",
    category: "Beverages",
    sellingPrice: "195",
    costPrice: "120",
    availableQuantity: "25",
    minStockThreshold: "10",
    maxStockThreshold: "60",
    aisleLocation: "Aisle 1 - Coffee & Tea",
    batchNumber: "NEW-26-01",
    expiryDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    primarySupplierId: "",
  });

  const categories = useMemo(() => {
    const set = new Set((state?.products ?? []).map((p) => p.category));
    return ["all", ...Array.from(set)];
  }, [state]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (state?.products ?? []).filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (statusFilter !== "all" && p.stockStatus !== statusFilter) return false;
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.includes(q)
        );
      }
      return true;
    });
  }, [state, search, categoryFilter, statusFilter]);

  function openAddModal() {
    setFormState({
      sku: `SKU-NEW-${Math.floor(100 + Math.random() * 899)}`,
      name: "",
      barcode: `8901425${Math.floor(100000 + Math.random() * 899999)}`,
      category: "Beverages",
      sellingPrice: "195",
      costPrice: "120",
      availableQuantity: "25",
      minStockThreshold: "10",
      maxStockThreshold: "60",
      aisleLocation: "Aisle 1 - Coffee & Tea",
      batchNumber: "NEW-26-01",
      expiryDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      primarySupplierId: state?.suppliers[0]?.id ?? "",
    });
    setAddOpen(true);
  }

  function openEditModal(prod: ProductWithInventory) {
    setFormState({
      sku: prod.sku,
      name: prod.name,
      barcode: prod.barcode,
      category: prod.category,
      sellingPrice: String(prod.sellingPrice),
      costPrice: String(prod.costPrice),
      availableQuantity: String(prod.availableQuantity),
      minStockThreshold: String(prod.minStockThreshold),
      maxStockThreshold: String(prod.maxStockThreshold),
      aisleLocation: prod.aisleLocation,
      batchNumber: prod.batchNumber,
      expiryDate: prod.expiryDate,
      primarySupplierId: prod.primarySupplierId,
    });
    setEditingProd(prod);
  }

  async function handleSaveNew(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          sellingPrice: Number(formState.sellingPrice),
          costPrice: Number(formState.costPrice),
          availableQuantity: Number(formState.availableQuantity),
          minStockThreshold: Number(formState.minStockThreshold),
          maxStockThreshold: Number(formState.maxStockThreshold),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add product");
      setAddOpen(false);
      await refresh();
      pushToast({ kind: "success", title: `Added ${data.product.sku}`, message: data.product.name });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Create failed",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProd) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/inventory/${editingProd.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          category: formState.category,
          sellingPrice: Number(formState.sellingPrice),
          costPrice: Number(formState.costPrice),
          availableQuantity: Number(formState.availableQuantity),
          minStockThreshold: Number(formState.minStockThreshold),
          maxStockThreshold: Number(formState.maxStockThreshold),
          aisleLocation: formState.aisleLocation,
          batchNumber: formState.batchNumber,
          expiryDate: formState.expiryDate,
          primarySupplierId: formState.primarySupplierId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update product");
      setEditingProd(null);
      await refresh();
      pushToast({ kind: "success", title: `Updated ${data.product.sku}`, message: "Inventory persisted." });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Update failed",
        message: err instanceof Error ? err.message : "Error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteProd) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/inventory/${deleteProd.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setDeleteProd(null);
      await refresh();
      pushToast({ kind: "success", title: "Product deleted", message: `${deleteProd.sku} removed.` });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Delete blocked",
        message: err instanceof Error ? err.message : "Insufficient role permissions",
      });
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      "retailens-inventory.csv",
      ["SKU", "Name", "Barcode", "Category", "Selling Price", "Cost Price", "Qty", "Min", "Max", "Status", "Aisle", "Expiry"],
      filteredProducts.map((p) => [
        p.sku,
        p.name,
        p.barcode,
        p.category,
        p.sellingPrice,
        p.costPrice,
        p.availableQuantity,
        p.minStockThreshold,
        p.maxStockThreshold,
        p.stockStatus,
        p.aisleLocation,
        p.expiryDate,
      ])
    );
    pushToast({ kind: "info", title: "Inventory CSV exported", message: `${filteredProducts.length} SKUs exported.` });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Inventory Management"
        subtitle="Manage SKU catalog, real-time stock quantities, batch expiry dates, thresholds, and persisted movement history."
        actions={
          <>
            <SecondaryButton type="button" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </SecondaryButton>
            <PrimaryButton type="button" onClick={openAddModal}>
              <Plus className="h-4 w-4" />
              Add Product
            </PrimaryButton>
          </>
        }
      />

      {/* Search & Filters */}
      <PanelCard className="py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search SKU, name, or barcode"
              placeholder="Search SKU, product name, or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[40px] w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-sm text-white placeholder-slate-500"
            />
          </div>

          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All Categories" : c}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by stock status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
      </PanelCard>

      {/* Inventory Table */}
      <PanelCard>
        <div tabIndex={0} role="region" aria-label="Store inventory table" className="table-wrapper">
          <table className="retail-table retail-table-responsive text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">SKU / Barcode</th>
                <th className="px-3 py-3">Category & Aisle</th>
                <th className="px-3 py-3">Price / Cost</th>
                <th className="px-3 py-3">Qty / Bounds</th>
                <th className="px-3 py-3">Expiry / Batch</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredProducts.map((p) => {
                const days = daysUntilDate(p.expiryDate);
                return (
                  <tr key={p.id} className="hover:bg-slate-900/50">
                    <th className="px-3 py-3 font-medium text-slate-100">
                      <div className="flex items-center gap-2.5">
                        <Image
                          src={p.imageUrl}
                          alt={p.name}
                          width={34}
                          height={34}
                          unoptimized
                          className="h-8 w-8 rounded-lg border border-slate-700 object-cover"
                        />
                        <div>
                          <p className="font-semibold text-white">{p.name}</p>
                          <p className="text-[11px] font-normal text-slate-400">{p.supplierName}</p>
                        </div>
                      </div>
                    </th>
                    <td data-label="SKU" className="px-3 py-3 font-mono text-slate-300">
                      <p className="text-cyan-300">{p.sku}</p>
                      <p className="text-[11px] text-slate-500">{p.barcode}</p>
                    </td>
                    <td data-label="Aisle" className="px-3 py-3 text-slate-300">
                      <p>{p.category}</p>
                      <p className="text-[11px] text-slate-500">{p.aisleLocation}</p>
                    </td>
                    <td data-label="Price" className="px-3 py-3 text-slate-200">
                      <p className="font-semibold">{formatINR(p.sellingPrice)}</p>
                      <p className="text-[11px] text-slate-500">Cost: {formatINR(p.costPrice)}</p>
                    </td>
                    <td data-label="Quantity" className="px-3 py-3">
                      <p className="font-mono text-sm font-bold text-white">{p.availableQuantity}</p>
                      <p className="text-[11px] text-slate-500">
                        Min {p.minStockThreshold} / Max {p.maxStockThreshold}
                      </p>
                    </td>
                    <td data-label="Expiry" className="px-3 py-3">
                      <p className={days <= 4 ? "font-semibold text-rose-400" : "text-slate-300"}>
                        {p.expiryDate} ({days}d)
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">{p.batchNumber}</p>
                    </td>
                    <td data-label="Status" className="px-3 py-3">
                      <StatusBadge
                        tone={
                          p.stockStatus === "in_stock"
                            ? "green"
                            : p.stockStatus === "low_stock"
                            ? "amber"
                            : "red"
                        }
                      >
                        {p.stockStatus.replace("_", " ")}
                      </StatusBadge>
                    </td>
                    <td data-label="Actions" className="px-3 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setHistoryProd(p)}
                          title="Stock History"
                          className="rounded-lg border border-slate-800 p-1.5 text-slate-300 hover:bg-slate-800"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          title="Edit Product"
                          className="rounded-lg border border-slate-800 p-1.5 text-blue-300 hover:bg-slate-800"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteProd(p)}
                          title="Delete Product"
                          className="rounded-lg border border-slate-800 p-1.5 text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PanelCard>

      {/* Add / Edit Modal */}
      <ModalDialog
        open={addOpen || Boolean(editingProd)}
        onClose={() => {
          setAddOpen(false);
          setEditingProd(null);
        }}
        title={editingProd ? `Edit ${editingProd.sku}` : "Add New Store Product"}
      >
        <form onSubmit={editingProd ? handleSaveEdit : handleSaveNew} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="p-sku" className="mb-1 block text-slate-300">SKU</label>
              <input
                id="p-sku"
                required
                disabled={Boolean(editingProd)}
                value={formState.sku}
                onChange={(e) => setFormState({ ...formState, sku: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="p-barcode" className="mb-1 block text-slate-300">Barcode</label>
              <input
                id="p-barcode"
                required
                disabled={Boolean(editingProd)}
                value={formState.barcode}
                onChange={(e) => setFormState({ ...formState, barcode: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label htmlFor="p-name" className="mb-1 block text-slate-300">Product Name</label>
            <input
              id="p-name"
              required
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="p-sell" className="mb-1 block text-slate-300">Selling Price (₹)</label>
              <input
                id="p-sell"
                type="number"
                step="0.01"
                required
                value={formState.sellingPrice}
                onChange={(e) => setFormState({ ...formState, sellingPrice: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              />
            </div>
            <div>
              <label htmlFor="p-cost" className="mb-1 block text-slate-300">Cost Price (₹)</label>
              <input
                id="p-cost"
                type="number"
                step="0.01"
                required
                value={formState.costPrice}
                onChange={(e) => setFormState({ ...formState, costPrice: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="p-qty" className="mb-1 block text-slate-300">Available Qty</label>
              <input
                id="p-qty"
                type="number"
                required
                value={formState.availableQuantity}
                onChange={(e) => setFormState({ ...formState, availableQuantity: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              />
            </div>
            <div>
              <label htmlFor="p-min" className="mb-1 block text-slate-300">Min Threshold</label>
              <input
                id="p-min"
                type="number"
                required
                value={formState.minStockThreshold}
                onChange={(e) => setFormState({ ...formState, minStockThreshold: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              />
            </div>
            <div>
              <label htmlFor="p-max" className="mb-1 block text-slate-300">Max Threshold</label>
              <input
                id="p-max"
                type="number"
                required
                value={formState.maxStockThreshold}
                onChange={(e) => setFormState({ ...formState, maxStockThreshold: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="p-aisle" className="mb-1 block text-slate-300">Aisle Location</label>
              <input
                id="p-aisle"
                required
                value={formState.aisleLocation}
                onChange={(e) => setFormState({ ...formState, aisleLocation: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              />
            </div>
            <div>
              <label htmlFor="p-exp" className="mb-1 block text-slate-300">Expiry Date</label>
              <input
                id="p-exp"
                type="date"
                required
                value={formState.expiryDate}
                onChange={(e) => setFormState({ ...formState, expiryDate: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <SecondaryButton
              type="button"
              onClick={() => {
                setAddOpen(false);
                setEditingProd(null);
              }}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? "Saving..." : editingProd ? "Save Changes" : "Create Product"}
            </PrimaryButton>
          </div>
        </form>
      </ModalDialog>

      {/* Delete Confirmation Dialog */}
      <ModalDialog
        open={Boolean(deleteProd)}
        onClose={() => setDeleteProd(null)}
        title="Confirm Product Deletion"
      >
        <p className="text-sm text-slate-300">
          Are you sure you want to permanently remove{" "}
          <strong className="text-white">{deleteProd?.name}</strong> ({deleteProd?.sku}) from the
          store catalog?
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <SecondaryButton type="button" autoFocus onClick={() => setDeleteProd(null)}>
            Cancel
          </SecondaryButton>
          <button
            type="button"
            disabled={busy}
            onClick={confirmDelete}
            className="inline-flex min-h-[40px] items-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? "Deleting..." : "Delete Product"}
          </button>
        </div>
      </ModalDialog>

      {/* Stock History Dialog */}
      <ModalDialog
        open={Boolean(historyProd)}
        onClose={() => setHistoryProd(null)}
        title={`Stock Movement History • ${historyProd?.sku ?? ""}`}
      >
        <div className="max-h-80 space-y-2.5 overflow-y-auto text-xs">
          {(state?.inventoryMovements ?? [])
            .filter((m) => m.productId === historyProd?.id)
            .map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{m.movementType}</span>
                  <span
                    className={
                      m.quantityDelta < 0 ? "font-mono text-rose-400" : "font-mono text-emerald-400"
                    }
                  >
                    {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta} ({m.quantityBefore} → {m.quantityAfter})
                  </span>
                </div>
                <p className="mt-1 text-slate-300">{m.reason}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {m.performedBy} • {formatRelativeTime(m.createdAt)}
                </p>
              </div>
            ))}
          {(state?.inventoryMovements ?? []).filter((m) => m.productId === historyProd?.id).length === 0 && (
            <p className="text-slate-400">No recorded stock movements for this SKU yet.</p>
          )}
        </div>
      </ModalDialog>
    </div>
  );
}

