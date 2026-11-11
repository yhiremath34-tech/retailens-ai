import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, Bot, CheckCircle2, XCircle } from "lucide-react";
import { RetaiLensLogo } from "@/components/ui/Logo";

const ARCHITECTURE_FLOW = [
  {
    stage: "CAMERA / POS INPUT",
    detail: "Live aisle cameras (CAM-01..04), checkout lane video (CAM-CHK-01/02), and POS barcode scans.",
  },
  {
    stage: "COMPUTER VISION AND EVENT DETECTION",
    detail: "FastAPI + OpenCV / YOLO interface extracts shelf occupancy %, bounding boxes, and confidence scores.",
  },
  {
    stage: "AI AGENT PERCEPTION",
    detail: "Agent ingests structured detection events, inventory deltas, and upcoming product expiry dates.",
  },
  {
    stage: "REASONING AND PLANNING",
    detail: "ReAct planner retrieves persistent PostgreSQL memory (velocity, lead-time drift, past approvals) before planning.",
  },
  {
    stage: "DETERMINISTIC TOOL EXECUTION",
    detail: "Server validates Zod tool arguments against RBAC & safety thresholds—never allowing raw LLM SQL.",
  },
  {
    stage: "HUMAN APPROVAL WHEN REQUIRED",
    detail: "High-value POs (>₹5,000), checkout overrides (<80% confidence), and discounts >15% pause for Store Manager review.",
  },
  {
    stage: "DATABASE MUTATION",
    detail: "Idempotent transactional updates mutate stock, purchase orders, pricing, and GST-preview receipts.",
  },
  {
    stage: "PERSISTENT MEMORY",
    detail: "Outcomes and human decisions persist to agent_memory across sessions for continuously smarter planning.",
  },
  {
    stage: "OPERATIONAL INSIGHTS",
    detail: "Executive Command Center, Event Timeline, Analytics, and Audit Logs update in real time.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-[100dvb] bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/">
            <RetaiLensLogo />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-1.5 text-xs font-medium text-sky-950 hover:bg-sky-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back Home
            </Link>
            <Link
              href="/dashboard/demo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-400 bg-sky-300 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-sky-400"
            >
              Run Demo Scenarios
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
            <Bot className="h-3.5 w-3.5 text-sky-600" />
            Hackathon Judge Architecture Guide
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            How RetaiLens AI Works
          </h1>
          <p className="mt-3 text-base text-slate-600">
            RetaiLens AI is an autonomous agentic operations platform—not a passive dashboard or a
            Q&A chatbot. Every perception triggers validated reasoning, memory retrieval, deterministic
            tool execution, and human-governed approvals.
          </p>
        </div>

        {/* End-to-End Flow */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-slate-950">End-to-End Execution Pipeline</h2>
          <div className="mt-6 flex flex-col items-center gap-3">
            {ARCHITECTURE_FLOW.map((node, idx) => (
              <div key={node.stage} className="w-full max-w-3xl">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold tracking-wider text-sky-700">
                      STAGE 0{idx + 1} • {node.stage}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-700">{node.detail}</p>
                </div>
                {idx < ARCHITECTURE_FLOW.length - 1 && (
                  <div className="flex justify-center py-1 text-sky-500">
                    <ArrowDown className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Traditional vs RetaiLens Comparison */}
        <section className="mt-14">
          <h2 className="text-xl font-bold text-slate-950">
            Traditional Retail Software vs. RetaiLens AI
          </h2>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
              <h3 className="text-base font-bold text-rose-800">Traditional Retail Software</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-700">
                {[
                  "Reactive — managers discover stockouts hours too late",
                  "Manual monitoring across disconnected CCTV and POS tools",
                  "Static threshold alerts with zero supplier lead-time context",
                  "Manual workflows for PO creation and expiry discounting",
                  "Limited historical memory for recurring SKU velocity surges",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6">
              <h3 className="text-base font-bold text-emerald-900">RetaiLens AI</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-800">
                {[
                  "Proactive — detects low shelf occupancy and expiry risk early",
                  "Automated CV + POS cross-verification at checkout lanes",
                  "Context-aware ReAct reasoning with 13 validated backend tools",
                  "Autonomous routine operations (verified sales, PO drafts, scans)",
                  "Persistent PostgreSQL memory across inventory, supplier & pricing",
                  "Human-controlled sensitive actions via Store Manager Approval Center",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

