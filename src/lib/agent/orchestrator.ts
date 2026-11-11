import crypto from "node:crypto";
import { GoogleGenAI, Type } from "@google/genai";
import { isGeminiConfigured } from "@/lib/env";
import {
  addAuditLog,
  getFullState,
  saveAgentRunAndTools,
} from "@/lib/db/repository";
import { AGENT_TOOLS, ToolContext } from "@/lib/agent/tools";
import { DEMO_STORE_ID } from "@/lib/seed-data";
import { AgentRun, AgentStep, AgentToolExecution } from "@/types/retailens";

export interface RunAgentInput {
  objective: string;
  triggerSource?: string;
  actorName?: string;
  scenarioContext?: {
    sku?: string;
    cameraId?: string;
    posBarcode?: string;
    visualConfidencePct?: number;
    shelfOccupancyPct?: number;
  };
}

function buildStep(
  phase: AgentStep["phase"],
  title: string,
  detail: string,
  status: AgentStep["status"] = "completed",
  toolName?: string
): AgentStep {
  return {
    id: crypto.randomUUID(),
    phase,
    title,
    detail,
    timestamp: new Date().toISOString(),
    toolName,
    status,
  };
}

async function executeValidatedTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  executions: AgentToolExecution[]
): Promise<{ status: AgentToolExecution["executionStatus"]; result: Record<string, unknown> }> {
  const spec = AGENT_TOOLS[toolName];
  if (!spec) {
    const err = `Security block: requested unknown or unauthorized tool '${toolName}'.`;
    executions.push({
      id: crypto.randomUUID(),
      agentRunId: ctx.agentRunId,
      toolName,
      inputArgs: args,
      executionStatus: "blocked",
      result: null,
      errorDetails: err,
      createdAt: new Date().toISOString(),
    });
    return { status: "blocked", result: { error: err } };
  }

  try {
    const parsed = spec.schema.parse(args) as Record<string, unknown>;
    const outcome = await spec.execute(parsed, ctx);
    executions.push({
      id: crypto.randomUUID(),
      agentRunId: ctx.agentRunId,
      toolName,
      inputArgs: parsed,
      executionStatus: outcome.status,
      result: outcome.result,
      errorDetails: outcome.status === "failed" ? String(outcome.result.error ?? "") : null,
      createdAt: new Date().toISOString(),
    });
    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution validation failed";
    executions.push({
      id: crypto.randomUUID(),
      agentRunId: ctx.agentRunId,
      toolName,
      inputArgs: args,
      executionStatus: "failed",
      result: null,
      errorDetails: message,
      createdAt: new Date().toISOString(),
    });
    return { status: "failed", result: { error: message } };
  }
}

async function runWithGeminiPlanner(
  input: RunAgentInput,
  runId: string,
  ctx: ToolContext,
  steps: AgentStep[],
  executions: AgentToolExecution[]
): Promise<{
  reasoningSummary: string;
  plannedActions: string[];
  finalSummary: string;
  awaitingApproval: boolean;
}> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const declarations = Object.values(AGENT_TOOLS).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: Type.OBJECT,
      properties: Object.fromEntries(
        Object.entries(
          (tool.parametersJsonSchema.properties as Record<string, { type: string; description?: string }>) ?? {}
        ).map(([k, v]) => [
          k,
          {
            type:
              v.type === "number"
                ? Type.NUMBER
                : v.type === "boolean"
                ? Type.BOOLEAN
                : Type.STRING,
            description: v.description || k,
          },
        ])
      ),
    },
  }));

  const state = await getFullState();
  const systemPrompt = `You are RetaiLens AI, an autonomous retail operations agent for ${state.store.name}.
You MUST follow PERCEIVE -> REASON -> PLAN -> ACT -> OBSERVE -> REMEMBER.
Never invent inventory numbers or memories. Always call tools to inspect inventory, retrieve agent memory, analyze vision feeds, calculate dynamic expiry discounts, or draft POs.
Never bypass human approval: PO dispatch and checkout overrides pause automatically in the Approval Center.
Available key SKUs: ${state.products.slice(0, 12).map((p) => `${p.sku} (${p.name}, stock=${p.availableQuantity})`).join(", ")}.`;

  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
    {
      role: "user",
      parts: [
        {
          text: `Objective: ${input.objective}\nContext: ${JSON.stringify(input.scenarioContext ?? {})}`,
        },
      ],
    },
  ];

  const plannedActions: string[] = [];
  let awaitingApproval = false;
  let finalText = "";

  for (let turn = 0; turn < 5; turn++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: declarations }],
        temperature: 0.2,
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const functionCalls = parts.filter((p) => "functionCall" in p && p.functionCall);
    const textParts = parts
      .filter((p) => "text" in p && p.text)
      .map((p) => p.text as string)
      .join("\n")
      .trim();

    if (textParts && turn === 0) {
      steps.push(buildStep("REASON", "Gemini Agent Reasoning", textParts));
    }

    if (functionCalls.length === 0) {
      finalText = textParts || "Agent completed operational reasoning loop.";
      break;
    }

    contents.push({ role: "model", parts: parts as Array<Record<string, unknown>> });
    const responseParts: Array<Record<string, unknown>> = [];

    for (const part of functionCalls) {
      const fc = part.functionCall!;
      const name = fc.name ?? "";
      const args = (fc.args ?? {}) as Record<string, unknown>;
      plannedActions.push(name);

      steps.push(
        buildStep(
          "ACT",
          `Executing ${name}`,
          `Validated arguments: ${JSON.stringify(args)}`,
          "completed",
          name
        )
      );

      const outcome = await executeValidatedTool(name, args, ctx, executions);
      if (outcome.status === "awaiting_approval") awaitingApproval = true;

      steps.push(
        buildStep(
          "OBSERVE",
          `Observed ${name} (${outcome.status})`,
          JSON.stringify(outcome.result).slice(0, 320),
          outcome.status === "awaiting_approval"
            ? "awaiting_approval"
            : outcome.status === "blocked"
            ? "blocked"
            : "completed",
          name
        )
      );

      responseParts.push({
        functionResponse: {
          name,
          response: outcome.result,
        },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  return {
    reasoningSummary: finalText || "Gemini structured ReAct loop executed validated retail tools.",
    plannedActions: [...new Set(plannedActions)],
    finalSummary: awaitingApproval
      ? `${finalText} Sensitive operation queued for authorized manager approval.`
      : finalText,
    awaitingApproval,
  };
}

async function runWithDeterministicPlanner(
  input: RunAgentInput,
  ctx: ToolContext,
  steps: AgentStep[],
  executions: AgentToolExecution[]
): Promise<{
  reasoningSummary: string;
  plannedActions: string[];
  finalSummary: string;
  awaitingApproval: boolean;
}> {
  const obj = input.objective.toLowerCase();
  const state = await getFullState();
  const plannedActions: string[] = [];
  let awaitingApproval = false;

  const isAnomaly =
    obj.includes("anomaly") ||
    obj.includes("mismatch") ||
    obj.includes("dispute") ||
    (input.scenarioContext?.visualConfidencePct !== undefined &&
      input.scenarioContext.visualConfidencePct < 80);

  const isExpiryPricing =
    obj.includes("expir") || obj.includes("discount") || obj.includes("pric");

  const isStockoutOrPo =
    obj.includes("stockout") ||
    obj.includes("low stock") ||
    obj.includes("low-stock") ||
    obj.includes("replenish") ||
    obj.includes("purchase order") ||
    obj.includes("olv-088") ||
    obj.includes("grn-012");

  const isCheckout = obj.includes("checkout") && !isAnomaly;

  const targetSku =
    input.scenarioContext?.sku ||
    (obj.includes("olv-088")
      ? "SKU-OLV-088"
      : obj.includes("grn-012")
      ? "SKU-GRN-012"
      : obj.includes("mlk-002")
      ? "SKU-MLK-002"
      : obj.includes("yog-006")
      ? "SKU-YOG-006"
      : isStockoutOrPo
      ? "SKU-OLV-088"
      : isAnomaly
      ? "SKU-YOG-006"
      : "SKU-COF-001");

  steps.push(
    buildStep(
      "PERCEIVE",
      "Perceived Store Objective & Telemetry",
      `Objective: "${input.objective}". Target SKU context: ${targetSku}. Initializing deterministic safety-validated ReAct loop.`
    )
  );

  // 1. Retrieve persistent memory first
  plannedActions.push("retrieve_agent_memory");
  const memOutcome = await executeValidatedTool(
    "retrieve_agent_memory",
    { sku: targetSku },
    ctx,
    executions
  );
  const memCount = Number((memOutcome.result.retrievedCount as number) || 0);
  steps.push(
    buildStep(
      "REASON",
      `Retrieved ${memCount} Cross-Session Memory Record(s)`,
      memCount > 0
        ? `Memory context for ${targetSku} loaded prior to action planning.`
        : `No prior memory specific to ${targetSku}; using real-time store thresholds.`,
      "completed",
      "retrieve_agent_memory"
    )
  );

  if (isAnomaly) {
    plannedActions.push(
      "analyze_checkout_and_shelf_feed",
      "mutate_pos_inventory_db",
      "create_checkout_dispute",
      "save_agent_memory"
    );
    steps.push(
      buildStep(
        "PLAN",
        "Planned Safe Anomaly Verification Pipeline",
        "1) Inspect camera/POS mismatch, 2) Attempt guarded mutation check (expects safety block <80%), 3) Escalate dispute to Approval Center."
      )
    );

    const feed = await executeValidatedTool(
      "analyze_checkout_and_shelf_feed",
      {
        cameraId: input.scenarioContext?.cameraId || "CAM-CHK-02",
        sku: "SKU-YOG-006",
        posBarcode: input.scenarioContext?.posBarcode || "8901425001028",
        visualConfidencePct: input.scenarioContext?.visualConfidencePct ?? 62.5,
      },
      ctx,
      executions
    );
    steps.push(
      buildStep(
        "ACT",
        "Analyzed Checkout Camera & POS Feed",
        `Barcode mismatch=${feed.result.barcodeMismatch}, Confidence=${feed.result.confidencePct}%.`,
        "completed",
        "analyze_checkout_and_shelf_feed"
      )
    );

    const blockedMut = await executeValidatedTool(
      "mutate_pos_inventory_db",
      {
        sku: "SKU-YOG-006",
        quantityDelta: -1,
        movementType: "sale_deduction",
        reason: "Checkout scan verification",
        visualConfidencePct: input.scenarioContext?.visualConfidencePct ?? 62.5,
      },
      ctx,
      executions
    );
    steps.push(
      buildStep(
        "OBSERVE",
        "Safety Policy Halted Automatic Inventory Mutation",
        String(blockedMut.result.reason || "Low-confidence mutation blocked."),
        "blocked",
        "mutate_pos_inventory_db"
      )
    );

    const dispute = await executeValidatedTool(
      "create_checkout_dispute",
      {
        cameraId: "CAM-CHK-02",
        scannedSku: "SKU-MLK-002",
        visualSku: "SKU-YOG-006",
        visualConfidencePct: input.scenarioContext?.visualConfidencePct ?? 62.5,
        disputeType: "barcode_mismatch",
        description:
          "POS scanned Hill Farm Whole Milk (₹85), while overhead camera flagged Clover Greek Yogurt (₹160) at low confidence.",
      },
      ctx,
      executions
    );
    awaitingApproval = true;
    steps.push(
      buildStep(
        "ACT",
        "Created Checkout Dispute & Manager Review Request",
        `Session ${dispute.result.sessionCode} paused; Approval ID ${dispute.result.approvalRequestId}.`,
        "awaiting_approval",
        "create_checkout_dispute"
      )
    );

    await executeValidatedTool(
      "save_agent_memory",
      {
        category: "checkout",
        sku: "SKU-YOG-006",
        title: "Checkout Anomaly Paused Safely",
        content: `Agent detected barcode mismatch at ${input.scenarioContext?.visualConfidencePct ?? 62.5}% confidence and withheld inventory mutation pending manager approval.`,
        relevanceScore: 0.9,
      },
      ctx,
      executions
    );
    steps.push(
      buildStep(
        "REMEMBER",
        "Saved Checkout Anomaly Event to Persistent Memory",
        "Recorded mismatch pattern in agent_memory for future lane monitoring.",
        "completed",
        "save_agent_memory"
      )
    );

    return {
      reasoningSummary:
        "Detected low-confidence checkout barcode mismatch; enforced safety boundary by blocking automatic inventory deduction and escalating to Manager Approval Center.",
      plannedActions,
      finalSummary:
        "Inventory mutation paused. Dispute escalated to Approval Center for authorized human review.",
      awaitingApproval,
    };
  }

  if (isCheckout) {
    plannedActions.push(
      "analyze_checkout_and_shelf_feed",
      "get_inventory_status",
      "mutate_pos_inventory_db",
      "save_agent_memory"
    );
    steps.push(
      buildStep(
        "PLAN",
        "Planned Autonomous Frictionless Checkout",
        `1) Verify camera detection for ${targetSku}, 2) Confirm stock availability, 3) Execute idempotent deduction.`
      )
    );

    const feed = await executeValidatedTool(
      "analyze_checkout_and_shelf_feed",
      {
        cameraId: input.scenarioContext?.cameraId || "CAM-CHK-01",
        sku: targetSku,
        visualConfidencePct: input.scenarioContext?.visualConfidencePct ?? 97.2,
      },
      ctx,
      executions
    );
    await executeValidatedTool("get_inventory_status", { sku: targetSku }, ctx, executions);
    steps.push(
      buildStep(
        "ACT",
        "Executed Camera & Inventory Verification",
        `Verified ${targetSku} via ${feed.result.cameraId} at ${feed.result.confidencePct}% confidence; executing idempotent POS deduction.`,
        "completed",
        "analyze_checkout_and_shelf_feed"
      )
    );
    const mut = await executeValidatedTool(
      "mutate_pos_inventory_db",
      {
        sku: targetSku,
        quantityDelta: -1,
        movementType: "sale_deduction",
        reason: `Verified frictionless checkout (${feed.result.confidencePct}% confidence)`,
        visualConfidencePct: Number(feed.result.confidencePct ?? 97.2),
      },
      ctx,
      executions
    );
    steps.push(
      buildStep(
        "OBSERVE",
        "Autonomous Inventory Deduction Verified",
        `${targetSku} stock updated: ${mut.result.quantityBefore} -> ${mut.result.quantityAfter} units.`,
        "completed",
        "mutate_pos_inventory_db"
      )
    );
    await executeValidatedTool(
      "save_agent_memory",
      {
        category: "checkout",
        sku: targetSku,
        title: "Frictionless Checkout Verified",
        content: `Verified checkout deduction for ${targetSku} at ${feed.result.confidencePct}% confidence.`,
        relevanceScore: 0.84,
      },
      ctx,
      executions
    );
    steps.push(
      buildStep("REMEMBER", "Logged Verified Checkout Pattern", `Updated memory for ${targetSku}.`)
    );

    return {
      reasoningSummary: `Camera and POS match verified at ${feed.result.confidencePct}% confidence. Executed transactional inventory deduction autonomously.`,
      plannedActions,
      finalSummary: `Frictionless checkout completed for ${targetSku}; stock is now ${mut.result.quantityAfter}.`,
      awaitingApproval: false,
    };
  }

  if (isExpiryPricing) {
    plannedActions.push("get_inventory_status", "calculate_dynamic_expiry_discount", "save_agent_memory");
    steps.push(
      buildStep(
        "PLAN",
        "Planned Expiry-Aware Dynamic Pricing Scan",
        "Inspect expiring SKUs and calculate margin-safe discounts within store pricing rules."
      )
    );
    const expiring = await executeValidatedTool(
      "get_inventory_status",
      { filterStatus: "expiring_soon" },
      ctx,
      executions
    );
    steps.push(
      buildStep(
        "ACT",
        "Computed Margin-Safe Expiry Discounts",
        `Evaluated ${Number(expiring.result.count ?? 0)} expiring SKU(s) against ${state.pricingRules.minMarginPct}% minimum margin policy.`,
        "completed",
        "calculate_dynamic_expiry_discount"
      )
    );
    const pricing = await executeValidatedTool(
      "calculate_dynamic_expiry_discount",
      { sku: obj.includes("mlk-002") ? "SKU-MLK-002" : undefined },
      ctx,
      executions
    );
    awaitingApproval = pricing.status === "awaiting_approval";
    const recs = (pricing.result.recommendations as Array<Record<string, unknown>>) || [];
    steps.push(
      buildStep(
        "OBSERVE",
        `Generated ${recs.length} Expiry Discount Recommendation(s)`,
        awaitingApproval
          ? "High-impact markdowns exceeding autonomous limit routed to Approval Center."
          : "Markdown recommendations staged within autonomous pricing floor.",
        awaitingApproval ? "awaiting_approval" : "completed",
        "calculate_dynamic_expiry_discount"
      )
    );
    await executeValidatedTool(
      "save_agent_memory",
      {
        category: "pricing",
        sku: targetSku,
        title: "Expiry Pricing Scan Completed",
        content: `Evaluated ${recs.length} perishable items under ${state.pricingRules.minMarginPct}% minimum margin policy.`,
        relevanceScore: 0.86,
      },
      ctx,
      executions
    );
    steps.push(
      buildStep("REMEMBER", "Persisted Expiry Pricing Context", "Saved dynamic pricing insights to agent_memory.")
    );
    return {
      reasoningSummary: `Analyzed perishable inventory and calculated margin-protected dynamic markdowns for ${recs.length} SKU(s).`,
      plannedActions,
      finalSummary: awaitingApproval
        ? "Dynamic pricing recommendations generated; changes >15% queued for Manager Approval."
        : "Dynamic pricing recommendations ready.",
      awaitingApproval,
    };
  }

  if (isStockoutOrPo) {
    plannedActions.push(
      "analyze_checkout_and_shelf_feed",
      "get_inventory_status",
      "detect_stock_depletion_velocity",
      "get_supplier_lead_times",
      "dispatch_supplier_purchase_order",
      "save_agent_memory"
    );
    steps.push(
      buildStep(
        "PLAN",
        `Planned Replenishment & PO Workflow for ${targetSku}`,
        "Verify shelf camera occupancy, compute depletion velocity, check supplier lead time, and draft PO for manager approval."
      )
    );

    const shelfFeed = await executeValidatedTool(
      "analyze_checkout_and_shelf_feed",
      {
        cameraId: input.scenarioContext?.cameraId || "CAM-04",
        sku: targetSku,
        shelfOccupancyPct: input.scenarioContext?.shelfOccupancyPct ?? 14,
      },
      ctx,
      executions
    );
    const inv = await executeValidatedTool("get_inventory_status", { sku: targetSku }, ctx, executions);
    const vel = await executeValidatedTool(
      "detect_stock_depletion_velocity",
      { sku: targetSku },
      ctx,
      executions
    );
    const sup = await executeValidatedTool("get_supplier_lead_times", { sku: targetSku }, ctx, executions);
    steps.push(
      buildStep(
        "ACT",
        `Prepared Replenishment Draft via ${sup.result.name || "Primary Supplier"}`,
        `Shelf occupancy ${shelfFeed.result.shelfOccupancyPct}%; velocity ${vel.result.dailyVelocity}/day (${vel.result.daysOfCover}d cover vs ${sup.result.avgLeadTimeDays}d lead time). Drafting PO for ${vel.result.suggestedReorderQty} units.`,
        "completed",
        "dispatch_supplier_purchase_order"
      )
    );
    const po = await executeValidatedTool(
      "dispatch_supplier_purchase_order",
      {
        sku: targetSku,
        quantity: Number(vel.result.suggestedReorderQty || 30),
        reason: `Stock ${inv.result.availableQuantity} <= threshold ${inv.result.minStockThreshold}; velocity ${vel.result.dailyVelocity}/day; supplier ${sup.result.name} lead time ${sup.result.avgLeadTimeDays}d.`,
      },
      ctx,
      executions
    );
    awaitingApproval = po.status === "awaiting_approval";
    steps.push(
      buildStep(
        "OBSERVE",
        `Purchase Order ${po.result.poNumber} Drafted`,
        `Order for ${po.result.orderedQuantity} units (₹${po.result.estimatedValue}) queued for manager authorization.`,
        "awaiting_approval",
        "dispatch_supplier_purchase_order"
      )
    );

    await executeValidatedTool(
      "save_agent_memory",
      {
        category: "supplier",
        sku: targetSku,
        title: `Replenishment PO ${po.result.poNumber} Prepared`,
        content: `Drafted PO for ${targetSku} (${po.result.orderedQuantity} units) factoring ${vel.result.dailyVelocity}/day depletion and ${sup.result.avgLeadTimeDays}d supplier lead time.`,
        relevanceScore: 0.91,
      },
      ctx,
      executions
    );
    steps.push(
      buildStep("REMEMBER", "Saved Replenishment Reasoning to Memory", "Recorded velocity & lead-time rationale.")
    );

    return {
      reasoningSummary: `Detected stock depletion risk on ${targetSku} (${inv.result.availableQuantity} units left, ${vel.result.daysOfCover} days cover vs ${sup.result.avgLeadTimeDays}d lead time). Drafted ${po.result.poNumber} and paused for manager approval.`,
      plannedActions,
      finalSummary: `PO ${po.result.poNumber} (₹${po.result.estimatedValue}) awaiting authorized Store Manager approval.`,
      awaitingApproval,
    };
  }

  // General Store Operational Health Sweep
  plannedActions.push(
    "generate_store_operational_report",
    "get_inventory_status",
    "calculate_dynamic_expiry_discount",
    "save_agent_memory"
  );
  steps.push(
    buildStep(
      "PLAN",
      "Planned Full Store Autonomous Operations Sweep",
      "Audit store metrics, identify low-stock SKUs, evaluate expiring stock, and surface actionable decisions."
    )
  );
  const report = await executeValidatedTool(
    "generate_store_operational_report",
    { includeRecommendations: true },
    ctx,
    executions
  );
  await executeValidatedTool("get_inventory_status", { filterStatus: "low_stock" }, ctx, executions);
  steps.push(
    buildStep(
      "ACT",
      "Executed Store-Wide Diagnostics & Pricing Sweep",
      `Audited ${report.result.totalSkus} SKUs, checked low-stock items, and scanned perishable inventory for markdown eligibility.`,
      "completed",
      "generate_store_operational_report"
    )
  );
  await executeValidatedTool("calculate_dynamic_expiry_discount", {}, ctx, executions);

  steps.push(
    buildStep(
      "OBSERVE",
      "Operational Store Snapshot Complete",
      `Tracked SKUs: ${report.result.totalSkus}, Low stock: ${report.result.lowStockCount}, Out of stock: ${report.result.outOfStockCount}, Expiring: ${report.result.expiringSoonCount}, Pending approvals: ${report.result.pendingApprovalsCount}.`,
      "completed",
      "generate_store_operational_report"
    )
  );
  await executeValidatedTool(
    "save_agent_memory",
    {
      category: "operational",
      title: "Store Operational Health Sweep",
      content: `Audit identified ${report.result.lowStockCount} low-stock and ${report.result.expiringSoonCount} expiring SKUs.`,
      relevanceScore: 0.85,
    },
    ctx,
    executions
  );
  steps.push(
    buildStep("REMEMBER", "Updated Store Operational Memory", "Saved audit summary to persistent memory.")
  );

  return {
    reasoningSummary: `Completed full store operational check across ${report.result.totalSkus} SKUs. Flagged ${report.result.lowStockCount} low-stock, ${report.result.outOfStockCount} out-of-stock, and ${report.result.expiringSoonCount} expiring products.`,
    plannedActions,
    finalSummary: `Store audit complete. ${report.result.pendingApprovalsCount} pending approvals require review.`,
    awaitingApproval: false,
  };
}

export async function runAutonomousAgent(input: RunAgentInput): Promise<{
  run: AgentRun;
  toolExecutions: AgentToolExecution[];
}> {
  const runId = crypto.randomUUID();
  const ctx: ToolContext = {
    agentRunId: runId,
    actorName: input.actorName || "RetaiLens Autonomous Agent",
  };
  const steps: AgentStep[] = [];
  const executions: AgentToolExecution[] = [];
  const geminiEnabled = isGeminiConfigured();

  let outcome: {
    reasoningSummary: string;
    plannedActions: string[];
    finalSummary: string;
    awaitingApproval: boolean;
  };
  let plannerMode: "gemini" | "deterministic" = geminiEnabled ? "gemini" : "deterministic";

  if (geminiEnabled) {
    try {
      steps.push(
        buildStep(
          "PERCEIVE",
          "Initialized Gemini Tool-Calling Agent",
          `Objective: "${input.objective}". Model: ${process.env.GEMINI_MODEL || "gemini-2.5-flash"}.`
        )
      );
      outcome = await runWithGeminiPlanner(input, runId, ctx, steps, executions);
    } catch (err) {
      plannerMode = "deterministic";
      steps.push(
        buildStep(
          "REASON",
          "Gemini API Fallback Activated",
          `External LLM call failed (${err instanceof Error ? err.message : "unknown"}); switched cleanly to deterministic ReAct planner.`
        )
      );
      outcome = await runWithDeterministicPlanner(input, ctx, steps, executions);
    }
  } else {
    outcome = await runWithDeterministicPlanner(input, ctx, steps, executions);
  }

  const now = new Date().toISOString();
  const run: AgentRun = {
    id: runId,
    storeId: DEMO_STORE_ID,
    objective: input.objective,
    triggerSource: input.triggerSource || "manual",
    plannerMode,
    status: outcome.awaitingApproval ? "awaiting_approval" : "completed",
    reasoningSummary: outcome.reasoningSummary,
    plannedActions: outcome.plannedActions,
    steps,
    finalSummary: outcome.finalSummary,
    createdAt: steps[0]?.timestamp ?? now,
    completedAt: outcome.awaitingApproval ? null : now,
  };

  await saveAgentRunAndTools(run, executions);
  await addAuditLog({
    actorId: runId,
    actorRole: "ai_agent",
    eventCategory: "agent",
    action: "agent_run_finished",
    entityType: "agent_run",
    entityId: runId,
    summary: `Agent (${plannerMode}) ran "${input.objective}" -> ${run.status}.`,
    details: { toolsCalled: executions.map((e) => e.toolName) },
  });

  return { run, toolExecutions: executions };
}

