import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Database,
  Layers,
  Lock,
  ScanBarcode,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
} from "lucide-react";
import { RetaiLensLogo } from "@/components/ui/Logo";

const AGENT_PHASES = [
  { step: "01", name: "PERCEIVE", desc: "Ingests OpenCV shelf detections, POS scans & expiry clocks." },
  { step: "02", name: "REASON", desc: "Correlates stock levels, depletion velocity & confidence scores." },
  { step: "03", name: "PLAN", desc: "Synthesizes safe multi-tool action plans bounded by policy." },
  { step: "04", name: "ACT", desc: "Executes validated deterministic tools or pauses for approval." },
  { step: "05", name: "OBSERVE", desc: "Verifies database mutations, receipts & supplier drafts." },
  { step: "06", name: "REMEMBER", desc: "Persists cross-session patterns in PostgreSQL agent memory." },
];

const CAPABILITIES = [
  {
    icon: Camera,
    title: "Computer Vision Shelf Monitoring",
    desc: "Detects empty facings, shelf occupancy %, and misplaced items via OpenCV & YOLO-compatible feeds.",
  },
  {
    icon: ScanBarcode,
    title: "Intelligent Checkout Verification",
    desc: "Cross-checks POS barcode scans against overhead vision; pauses low-confidence mutations automatically.",
  },
  {
    icon: Tag,
    title: "Expiry-Aware Dynamic Pricing",
    desc: "Calculates margin-safe markdowns for approaching-expiry batches while honoring store floor rules.",
  },
  {
    icon: Bot,
    title: "Autonomous Replenishment Drafts",
    desc: "Computes depletion velocity + supplier lead times to draft POs—then waits for manager sign-off.",
  },
  {
    icon: BrainCircuit,
    title: "Persistent Cross-Session Memory",
    desc: "Remembers SKU evening rushes, supplier lead-time drift, and past manager approval patterns.",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-Loop Governance",
    desc: "High-value POs, checkout overrides, and steep discounts require explicit authorized role approval.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvb] bg-[#090d14] text-slate-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#090d14]/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/">
            <RetaiLensLogo />
          </Link>
          <nav aria-label="Landing navigation" className="flex flex-wrap items-center gap-3 sm:gap-5">
            <Link
              href="/how-it-works"
              className="text-sm font-medium text-slate-300 transition hover:text-cyan-300"
            >
              Architecture
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/dashboard/demo"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Live Demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-800/70 py-16 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              Hackathon PS-07 Open Track • Team NEXORA
            </div>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Your Store. One Autonomous Intelligence.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Traditional retail dashboards only report problems after revenue is lost.{" "}
              <strong className="text-white">RetaiLens AI</strong> perceives shelf & checkout activity
              via computer vision, reasons across persistent operational memory, executes safe
              deterministic tools, and keeps store managers in control of high-stakes approvals.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href="/login?next=/dashboard/demo"
                className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:bg-blue-500"
              >
                Launch Live Demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800"
              >
                Explore Architecture
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-8 sm:grid-cols-4">
              <div>
                <p className="text-2xl font-bold text-white">13</p>
                <p className="text-xs text-slate-400">Deterministic Agent Tools</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">22</p>
                <p className="text-xs text-slate-400">PostgreSQL Relational Tables</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">4 Roles</p>
                <p className="text-xs text-slate-400">Server-Enforced RBAC</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">HITL</p>
                <p className="text-xs text-slate-400">Human Approval Gatekeeper</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="border-b border-slate-800/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Built for Real Store Operations — Not a Generic Chatbot
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Every alert connects directly to validated backend workflows, transactional inventory
            mutations, and role-authorized approvals.
          </p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="rounded-xl border border-slate-800 bg-[#0f1623] p-5 transition hover:border-blue-500/40"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{cap.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{cap.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Agent Workflow Section */}
      <section className="border-b border-slate-800/70 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                ReAct Agentic Orchestration Loop
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                The model reasons and selects validated tools; the server enforces permissions,
                idempotency, and approval safety checks.
              </p>
            </div>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-400 hover:text-cyan-300"
            >
              Inspect full pipeline diagram
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {AGENT_PHASES.map((phase) => (
              <div
                key={phase.name}
                className="rounded-xl border border-slate-800 bg-[#0f1623] p-4"
              >
                <span className="font-mono text-xs font-bold text-blue-400">{phase.step}</span>
                <h3 className="mt-1 font-mono text-sm font-bold text-white">{phase.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{phase.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CV & Human Approval Split */}
      <section className="border-b border-slate-800/70 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-[#0f1623] p-6">
            <div className="flex items-center gap-2 text-cyan-300">
              <Camera className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Computer Vision Pipeline
              </span>
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">
              OpenCV & YOLO-Compatible Frame Analysis
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Separates simulated demo feeds from connected FastAPI OpenCV media processing. Supports
              live frame uploads, edge-density shelf occupancy estimation, and Sobel/EAN barcode
              verification.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Confidence-gated POS mutations (auto-pauses below 80%)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Real-time missing facing & shelf occupancy tracking
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0f1623] p-6">
            <div className="flex items-center gap-2 text-amber-300">
              <Lock className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Human-in-the-Loop Safety
              </span>
            </div>
            <h3 className="mt-3 text-xl font-bold text-white">
              Zero Unchecked Financial or Inventory Overrides
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              AI agents draft purchase orders and recommend dynamic markdowns—but only authenticated
              Store Managers or Owners can approve high-value dispatches or disputed checkouts.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Server-side RBAC + idempotent execution keys
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Full audit log & feedback persisted to agent memory
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="border-b border-slate-800/70 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Production Architecture Stack
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {[
              { icon: Layers, label: "Next.js App Router + TypeScript" },
              { icon: Database, label: "Supabase PostgreSQL + RLS" },
              { icon: Bot, label: "Gemini Tool Calling + ReAct" },
              { icon: Camera, label: "Python FastAPI + OpenCV" },
              { icon: TrendingUp, label: "Recharts + Tailwind CSS" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0f1623] px-3.5 py-2 text-xs font-medium text-slate-200"
                >
                  <Icon className="h-3.5 w-3.5 text-cyan-400" />
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team NEXORA Footer */}
      <footer className="py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-slate-400 sm:px-6">
          <div>
            <p className="font-semibold text-slate-200">
              RetaiLens AI • Team NEXORA (Hackathon PS-07 – Open Track)
            </p>
            <p className="mt-0.5">
              Autonomous Retail Operations & Intelligent Checkout Agent Platform
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/how-it-works" className="hover:text-slate-200">
              How It Works
            </Link>
            <Link href="/login" className="hover:text-slate-200">
              Command Center
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

