"use client";

import React, { useMemo, useState } from "react";
import { BrainCircuit, Plus, Search } from "lucide-react";
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
import { formatRelativeTime } from "@/lib/utils";
import { MemoryCategory } from "@/types/retailens";

const CATEGORIES: Array<"all" | MemoryCategory> = [
  "all",
  "inventory",
  "supplier",
  "checkout",
  "pricing",
  "operational",
];

export default function AgentMemoryPage() {
  const { state, refresh } = useStoreData();
  const { pushToast } = useToast();

  const [category, setCategory] = useState<"all" | MemoryCategory>("all");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: "inventory" as MemoryCategory,
    sku: "SKU-OLV-088",
    title: "",
    content: "",
    influenceNote: "",
  });

  const memories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (state?.agentMemory ?? []).filter((m) => {
      if (category !== "all" && m.category !== category) return false;
      if (q) {
        return (
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q) ||
          (m.sku?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [state, category, query]);

  async function addMemory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save memory");
      setModalOpen(false);
      setForm({ category: "inventory", sku: "SKU-OLV-088", title: "", content: "", influenceNote: "" });
      await refresh();
      pushToast({ kind: "success", title: "Operational memory saved", message: data.memory.title });
    } catch (err) {
      pushToast({ kind: "error", title: "Save failed", message: err instanceof Error ? err.message : "Error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Persistent Cross-Session Agent Memory"
        subtitle="Structured retail memory retrieved by the ReAct agent before planning replenishments, checkout verifications, and dynamic discounts."
        actions={
          <PrimaryButton type="button" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Record Operational Memory
          </PrimaryButton>
        }
      />

      <PanelCard className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                  category === cat
                    ? "bg-blue-600 text-white"
                    : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Filter memories by SKU or keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-3 text-xs text-white"
            />
          </div>
        </div>
      </PanelCard>

      <div className="grid gap-4 md:grid-cols-2">
        {memories.map((mem) => (
          <PanelCard key={mem.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-cyan-400" />
                <StatusBadge tone="blue">{mem.category}</StatusBadge>
                {mem.sku && <StatusBadge tone="cyan">{mem.sku}</StatusBadge>}
              </div>
              <span className="font-mono text-[11px] text-emerald-400">
                Relevance {(mem.relevanceScore * 100).toFixed(0)}%
              </span>
            </div>

            <h2 className="text-sm font-bold text-white">{mem.title}</h2>
            <p className="text-xs leading-relaxed text-slate-300">{mem.content}</p>

            {mem.influenceNote && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-2.5 text-[11px] text-blue-200">
                <strong>Recommendation Influence:</strong> {mem.influenceNote}
              </div>
            )}

            <p className="text-[11px] text-slate-500">
              Recorded {formatRelativeTime(mem.createdAt)} • ID {mem.id.slice(0, 8)}
            </p>
          </PanelCard>
        ))}
      </div>

      <ModalDialog open={modalOpen} onClose={() => setModalOpen(false)} title="Save Agent Memory Record">
        <form onSubmit={addMemory} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="m-cat" className="mb-1 block text-slate-300">Category</label>
              <select
                id="m-cat"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as MemoryCategory })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              >
                <option value="inventory">Inventory</option>
                <option value="supplier">Supplier</option>
                <option value="checkout">Checkout</option>
                <option value="pricing">Pricing</option>
                <option value="operational">Operational</option>
              </select>
            </div>
            <div>
              <label htmlFor="m-sku" className="mb-1 block text-slate-300">Related SKU</label>
              <input
                id="m-sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
              />
            </div>
          </div>
          <div>
            <label htmlFor="m-title" className="mb-1 block text-slate-300">Title</label>
            <input
              id="m-title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
            />
          </div>
          <div>
            <label htmlFor="m-content" className="mb-1 block text-slate-300">Observed Pattern</label>
            <textarea
              id="m-content"
              required
              rows={3}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-white"
            />
          </div>
          <div>
            <label htmlFor="m-inf" className="mb-1 block text-slate-300">Planning Influence Note</label>
            <input
              id="m-inf"
              value={form.influenceNote}
              onChange={(e) => setForm({ ...form, influenceNote: e.target.value })}
              className="min-h-[38px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton type="button" onClick={() => setModalOpen(false)}>Cancel</SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving..." : "Persist Memory"}
            </PrimaryButton>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

