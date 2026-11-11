import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import {
  addAuditLog,
  getFullState,
  resetDemoState,
  saveAgentRunAndTools,
  saveCheckoutAndDispute,
} from "@/lib/db/repository";
import { DEMO_STORE_ID } from "@/lib/seed-data";
import { AgentRun, AgentStep, AgentToolExecution } from "@/types/retailens";

const ScenarioSchema = z.object({
  scenario: z.enum([
    "frictionless_checkout",
    "shelf_stockout",
    "checkout_anomaly",
    "reset",
  ]),
  stepIndex: z.number().int().min(0).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiSession("run_demo");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const parsed = ScenarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid scenario request." }, { status: 400 });
    }

    if (parsed.data.scenario === "reset") {
      const fresh = await resetDemoState(auth.session);
      return NextResponse.json({
        scenario: "reset",
        message: "Demo store state reset to clean synthetic baseline.",
        state: fresh,
      });
    }

    const state = await getFullState();
    const runId = crypto.randomUUID();
    const ctx = { agentRunId: runId, actorName: "RetaiLens Demo Orchestrator" };
    const steps: AgentStep[] = [];
    const executions: AgentToolExecution[] = [];
    const now = () => new Date().toISOString();

    const recordTool = async (name: string, args: Record<string, unknown>) => {
      const outcome = await AGENT_TOOLS[name].execute(args, ctx);
      executions.push({
        id: crypto.randomUUID(),
        agentRunId: runId,
        toolName: name,
        inputArgs: args,
        executionStatus: outcome.status,
        result: outcome.result,
        errorDetails: null,
        createdAt: now(),
      });
      return outcome;
    };

    if (parsed.data.scenario === "frictionless_checkout") {
      // SCENARIO A: FRICTIONLESS CHECKOUT
      const prod = state.products.find((p) => p.sku === "SKU-COF-001") ?? state.products[0];
      const feed = await recordTool("analyze_checkout_and_shelf_feed", {
        cameraId: "CAM-CHK-01",
        sku: prod.sku,
        posBarcode: prod.barcode,
        visualConfidencePct: 97.8,
        feedMode: "demo",
      });
      steps.push({
        id: crypto.randomUUID(),
        phase: "PERCEIVE",
        title: "Camera CAM-CHK-01 Detected Basket Item",
        detail: `Identified ${prod.name} (${prod.sku}) at 97.8% confidence.`,
        timestamp: now(),
        toolName: "analyze_checkout_and_shelf_feed",
        status: "completed",
      });

      const inv = await recordTool("get_inventory_status", { sku: prod.sku });
      steps.push({
        id: crypto.randomUUID(),
        phase: "REASON",
        title: "Verified POS Barcode & Stock Availability",
        detail: `Barcode ${prod.barcode} matched POS record; ${inv.result.availableQuantity} units available.`,
        timestamp: now(),
        toolName: "get_inventory_status",
        status: "completed",
      });

      const mut = await recordTool("mutate_pos_inventory_db", {
        sku: prod.sku,
        quantityDelta: -1,
        movementType: "sale_deduction",
        reason: "Scenario A: Autonomous Frictionless Checkout",
        visualConfidencePct: 97.8,
      });
      steps.push({
        id: crypto.randomUUID(),
        phase: "ACT",
        title: "Transactional Inventory Deduction Executed",
        detail: `Stock deducted atomically: ${mut.result.quantityBefore} -> ${mut.result.quantityAfter}.`,
        timestamp: now(),
        toolName: "mutate_pos_inventory_db",
        status: "completed",
      });

      const sessionId = crypto.randomUUID();
      const sessionCode = `CHK-DEMO-${Math.floor(4000 + Math.random() * 5000)}`;
      const subtotal = prod.sellingPrice;
      const gstAmount = Number(((subtotal * state.store.gstRatePct) / 100).toFixed(2));
      const totalAmount = Number((subtotal + gstAmount).toFixed(2));

      const session = {
        id: sessionId,
        sessionCode,
        storeId: DEMO_STORE_ID,
        cashierId: "Autonomous Lane 01",
        cameraId: "CAM-CHK-01",
        status: "completed" as const,
        visualConfidence: 97.8,
        subtotal,
        gstAmount,
        totalAmount,
        anomalyReason: null,
        items: [
          {
            id: crypto.randomUUID(),
            checkoutSessionId: sessionId,
            productId: prod.id,
            sku: prod.sku,
            productName: prod.name,
            scannedBarcode: prod.barcode,
            expectedPrice: prod.sellingPrice,
            posPrice: prod.sellingPrice,
            quantity: 1,
            visualConfidence: 97.8,
            matchStatus: "matched" as const,
          },
        ],
        createdAt: now(),
        updatedAt: now(),
      };
      await saveCheckoutAndDispute(session, null);

      await recordTool("save_agent_memory", {
        category: "checkout",
        sku: prod.sku,
        title: `Frictionless Checkout ${sessionCode}`,
        content: `Autonomously verified and completed checkout ${sessionCode} for ${prod.sku} at 97.8% confidence.`,
        relevanceScore: 0.85,
      });
      steps.push({
        id: crypto.randomUUID(),
        phase: "REMEMBER",
        title: "Simulated GST Receipt & Memory Persisted",
        detail: `Receipt ${sessionCode} (₹${totalAmount}) generated and transaction committed.`,
        timestamp: now(),
        toolName: "save_agent_memory",
        status: "completed",
      });

      const run: AgentRun = {
        id: runId,
        storeId: DEMO_STORE_ID,
        objective: "Scenario A: Execute Frictionless Checkout Verification",
        triggerSource: "demo_center",
        plannerMode: "deterministic",
        status: "completed",
        reasoningSummary: `Verified ${prod.sku} across CAM-CHK-01 and POS barcode ${prod.barcode} (97.8% confidence). Deducted 1 unit autonomously.`,
        plannedActions: [
          "analyze_checkout_and_shelf_feed",
          "get_inventory_status",
          "mutate_pos_inventory_db",
          "save_agent_memory",
        ],
        steps,
        finalSummary: `Completed autonomous checkout ${sessionCode} (₹${totalAmount}).`,
        createdAt: steps[0].timestamp,
        completedAt: now(),
      };
      await saveAgentRunAndTools(run, executions);
      await addAuditLog({
        actorId: auth.session.id,
        actorRole: auth.session.role,
        eventCategory: "demo",
        action: "scenario_a_executed",
        entityType: "checkout_session",
        entityId: sessionId,
        summary: `Demo Scenario A completed checkout ${sessionCode} autonomously.`,
        details: { feed: feed.result, mutation: mut.result },
      });

      return NextResponse.json({
        scenario: "frictionless_checkout",
        run,
        toolExecutions: executions,
        receiptSession: session,
      });
    }

    if (parsed.data.scenario === "shelf_stockout") {
      // SCENARIO B: SHELF STOCKOUT -> PO DRAFT -> HUMAN APPROVAL
      const prod = state.products.find((p) => p.sku === "SKU-OLV-088") ?? state.products[2];
      await recordTool("analyze_checkout_and_shelf_feed", {
        cameraId: "CAM-04",
        sku: prod.sku,
        shelfOccupancyPct: 12.0,
        visualConfidencePct: 95.4,
      });
      steps.push({
        id: crypto.randomUUID(),
        phase: "PERCEIVE",
        title: "CAM-04 Detected Low Shelf Occupancy (12%)",
        detail: `Vision detected depleted facings for ${prod.name} (${prod.sku}) on Aisle 4.`,
        timestamp: now(),
        toolName: "analyze_checkout_and_shelf_feed",
        status: "completed",
      });

      const inv = await recordTool("get_inventory_status", { sku: prod.sku });
      const mem = await recordTool("retrieve_agent_memory", { sku: prod.sku });
      const vel = await recordTool("detect_stock_depletion_velocity", { sku: prod.sku });
      const sup = await recordTool("get_supplier_lead_times", { sku: prod.sku });

      steps.push({
        id: crypto.randomUUID(),
        phase: "REASON",
        title: "Retrieved Depletion Velocity & Supplier Memory",
        detail: `Stock=${inv.result.availableQuantity}, Velocity=${vel.result.dailyVelocity}/day, Lead time=${sup.result.avgLeadTimeDays}d, Memories=${mem.result.retrievedCount}.`,
        timestamp: now(),
        toolName: "detect_stock_depletion_velocity",
        status: "completed",
      });

      const po = await recordTool("dispatch_supplier_purchase_order", {
        sku: prod.sku,
        quantity: Number(vel.result.suggestedReorderQty || 36),
        reason: `Scenario B: Low-stock replenishment (${inv.result.availableQuantity} left vs ${inv.result.minStockThreshold} threshold).`,
      });

      steps.push({
        id: crypto.randomUUID(),
        phase: "ACT",
        title: `Drafted ${po.result.poNumber} & Paused for Manager Approval`,
        detail: `Order value ₹${po.result.estimatedValue} exceeds autonomous limit. Waiting in Approval Center.`,
        timestamp: now(),
        toolName: "dispatch_supplier_purchase_order",
        status: "awaiting_approval",
      });

      await recordTool("save_agent_memory", {
        category: "inventory",
        sku: prod.sku,
        title: `Scenario B Stockout Replenishment (${po.result.poNumber})`,
        content: `Prepared PO ${po.result.poNumber} for ${po.result.orderedQuantity} units of ${prod.sku}; awaiting manager approval.`,
        relevanceScore: 0.93,
      });
      steps.push({
        id: crypto.randomUUID(),
        phase: "REMEMBER",
        title: "Recorded Replenishment Context in Memory",
        detail: "Agent awaits human authorization before dispatching PO to supplier.",
        timestamp: now(),
        toolName: "save_agent_memory",
        status: "completed",
      });

      const run: AgentRun = {
        id: runId,
        storeId: DEMO_STORE_ID,
        objective: "Scenario B: Autonomous Shelf Stockout Detection & Replenishment",
        triggerSource: "demo_center",
        plannerMode: "deterministic",
        status: "awaiting_approval",
        reasoningSummary: `Detected low stock on ${prod.sku}, correlated 6.2/day velocity and 4-day supplier lead time, drafted ${po.result.poNumber} (₹${po.result.estimatedValue}), and paused for human approval.`,
        plannedActions: [
          "analyze_checkout_and_shelf_feed",
          "get_inventory_status",
          "retrieve_agent_memory",
          "detect_stock_depletion_velocity",
          "get_supplier_lead_times",
          "dispatch_supplier_purchase_order",
        ],
        steps,
        finalSummary: `PO ${po.result.poNumber} queued for Store Manager approval.`,
        createdAt: steps[0].timestamp,
        completedAt: null,
      };
      await saveAgentRunAndTools(run, executions);

      return NextResponse.json({
        scenario: "shelf_stockout",
        run,
        toolExecutions: executions,
        approvalRequestId: po.result.approvalRequestId,
        poNumber: po.result.poNumber,
      });
    }

    // SCENARIO C: CHECKOUT SCAN ANOMALY
    const prodMilk = state.products.find((p) => p.sku === "SKU-MLK-002") ?? state.products[1];
    const prodYogurt = state.products.find((p) => p.sku === "SKU-YOG-006") ?? state.products[5];

    await recordTool("analyze_checkout_and_shelf_feed", {
      cameraId: "CAM-CHK-02",
      sku: prodYogurt.sku,
      posBarcode: prodMilk.barcode,
      visualConfidencePct: 61.8,
    });
    steps.push({
      id: crypto.randomUUID(),
      phase: "PERCEIVE",
      title: "CAM-CHK-02 Detected Barcode vs Visual Mismatch",
      detail: `POS scanned ${prodMilk.sku} (₹${prodMilk.sellingPrice}) while CV predicted ${prodYogurt.sku} (₹${prodYogurt.sellingPrice}) at 61.8% confidence.`,
      timestamp: now(),
      toolName: "analyze_checkout_and_shelf_feed",
      status: "completed",
    });

    const blocked = await recordTool("mutate_pos_inventory_db", {
      sku: prodYogurt.sku,
      quantityDelta: -1,
      movementType: "sale_deduction",
      reason: "Attempted checkout deduction on anomalous scan",
      visualConfidencePct: 61.8,
    });
    steps.push({
      id: crypto.randomUUID(),
      phase: "REASON",
      title: "Safety Guard Blocked Unauthorized Inventory Mutation",
      detail: String(blocked.result.reason),
      timestamp: now(),
      toolName: "mutate_pos_inventory_db",
      status: "blocked",
    });

    const dispute = await recordTool("create_checkout_dispute", {
      cameraId: "CAM-CHK-02",
      scannedSku: prodMilk.sku,
      visualSku: prodYogurt.sku,
      visualConfidencePct: 61.8,
      disputeType: "barcode_mismatch",
      description:
        "Scenario C: POS scanned Hill Farm Whole Milk (₹85) while camera flagged Clover Greek Yogurt (₹160) at 61.8% confidence.",
    });
    steps.push({
      id: crypto.randomUUID(),
      phase: "ACT",
      title: `Checkout ${dispute.result.sessionCode} Paused & Sent to Review Queue`,
      detail: "Created checkout dispute & manager approval card; zero unauthorized DB mutations occurred.",
      timestamp: now(),
      toolName: "create_checkout_dispute",
      status: "awaiting_approval",
    });

    await recordTool("save_agent_memory", {
      category: "checkout",
      sku: prodYogurt.sku,
      title: `Scenario C Dispute ${dispute.result.sessionCode}`,
      content: "Paused low-confidence chilled dairy scan (61.8%) pending manager evidence review.",
      relevanceScore: 0.9,
    });
    steps.push({
      id: crypto.randomUUID(),
      phase: "REMEMBER",
      title: "Logged Anomaly Pattern to Agent Memory",
      detail: "Awaiting authorized manager decision in Approval Center.",
      timestamp: now(),
      toolName: "save_agent_memory",
      status: "completed",
    });

    const run: AgentRun = {
      id: runId,
      storeId: DEMO_STORE_ID,
      objective: "Scenario C: Checkout Scan Anomaly Protection",
      triggerSource: "demo_center",
      plannerMode: "deterministic",
      status: "awaiting_approval",
      reasoningSummary:
        "Detected low-confidence (61.8%) barcode mismatch on Lane 02. Blocked inventory deduction and routed evidence to Store Manager Approval Center.",
      plannedActions: [
        "analyze_checkout_and_shelf_feed",
        "mutate_pos_inventory_db",
        "create_checkout_dispute",
        "save_agent_memory",
      ],
      steps,
      finalSummary: `Paused checkout ${dispute.result.sessionCode} pending human authorization.`,
      createdAt: steps[0].timestamp,
      completedAt: null,
    };
    await saveAgentRunAndTools(run, executions);

    return NextResponse.json({
      scenario: "checkout_anomaly",
      run,
      toolExecutions: executions,
      approvalRequestId: dispute.result.approvalRequestId,
      sessionCode: dispute.result.sessionCode,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Demo scenario failed." },
      { status: 500 }
    );
  }
}

