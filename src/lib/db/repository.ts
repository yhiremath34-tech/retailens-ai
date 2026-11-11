import crypto from "node:crypto";
import { isGeminiConfigured, isSupabaseConfigured } from "@/lib/env";
import {
  applyAtomicInventoryDeltaInMemory,
  readLocalDb,
  resetLocalDbToSeed,
  withLocalDbTransaction,
} from "@/lib/db/local-db";
import { loadFullStateFromSupabase } from "@/lib/db/supabase-adapter";
import { createSupabaseAdminClient } from "@/lib/db/supabase";
import { computeStockStatus, DEMO_STORE_ID } from "@/lib/seed-data";
import {
  AgentMemoryRecord,
  AgentRun,
  AgentToolExecution,
  ApprovalDecision,
  ApprovalRequest,
  AuditLog,
  CheckoutDispute,
  CheckoutSession,
  DatabaseState,
  InventoryMovement,
  PriceRecommendation,
  PricingRules,
  ProductWithInventory,
  PurchaseOrder,
  StoreNotification,
  UserRole,
  UserSession,
  VisionEvent,
} from "@/types/retailens";

export async function getSystemModes() {
  const supabaseActive = isSupabaseConfigured();
  const geminiActive = isGeminiConfigured();

  let visionFastApiActive = false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 800);
    const url = process.env.VISION_SERVICE_URL?.trim() || "http://127.0.0.1:8000";
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(t);
    visionFastApiActive = res.ok;
  } catch {
    visionFastApiActive = false;
  }

  return {
    databaseMode: supabaseActive ? ("supabase" as const) : ("simulation" as const),
    authMode: supabaseActive ? ("supabase" as const) : ("simulation" as const),
    aiPlannerMode: geminiActive ? ("gemini" as const) : ("deterministic" as const),
    visionMode: visionFastApiActive ? ("fastapi_opencv" as const) : ("simulation" as const),
  };
}

export async function getFullState(): Promise<DatabaseState> {
  if (isSupabaseConfigured()) {
    return loadFullStateFromSupabase();
  }
  return readLocalDb();
}

export async function mutateInventory(params: {
  productId: string;
  quantityDelta: number;
  movementType: InventoryMovement["movementType"];
  reason: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  performedBy: string;
}): Promise<{
  idempotentReplay: boolean;
  quantityBefore: number;
  quantityAfter: number;
  productSku: string;
  productName: string;
}> {
  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    const { data, error } = await sb.rpc("mutate_inventory_atomic", {
      p_store_id: DEMO_STORE_ID,
      p_product_id: params.productId,
      p_quantity_delta: params.quantityDelta,
      p_movement_type: params.movementType,
      p_reason: params.reason,
      p_reference_type: params.referenceType ?? null,
      p_reference_id: params.referenceId ?? null,
      p_idempotency_key: params.idempotencyKey ?? null,
      p_performed_by: params.performedBy,
    });
    if (error) throw new Error(error.message);
    const { data: prod } = await sb
      .from("products")
      .select("sku, name")
      .eq("id", params.productId)
      .single();
    return {
      idempotentReplay: Boolean(data.idempotent_replay),
      quantityBefore: data.quantity_before,
      quantityAfter: data.quantity_after,
      productSku: prod?.sku ?? "",
      productName: prod?.name ?? "Product",
    };
  }

  return withLocalDbTransaction((state) => {
    const res = applyAtomicInventoryDeltaInMemory(state, params);
    return {
      idempotentReplay: res.idempotentReplay,
      quantityBefore: res.quantityBefore,
      quantityAfter: res.quantityAfter,
      productSku: res.movement.sku,
      productName: res.movement.productName,
    };
  });
}

export async function addAuditLog(entry: Omit<AuditLog, "id" | "storeId" | "createdAt">): Promise<AuditLog> {
  const record: AuditLog = {
    id: crypto.randomUUID(),
    storeId: DEMO_STORE_ID,
    createdAt: new Date().toISOString(),
    ...entry,
  };

  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb.from("audit_logs").insert({
      id: record.id,
      store_id: record.storeId,
      actor_id: record.actorId,
      actor_role: record.actorRole,
      event_category: record.eventCategory,
      action: record.action,
      entity_type: record.entityType,
      entity_id: record.entityId,
      summary: record.summary,
      details: record.details,
      created_at: record.createdAt,
    });
    return record;
  }

  return withLocalDbTransaction((state) => {
    state.auditLogs.unshift(record);
    return record;
  });
}

export async function addNotification(
  notif: Omit<StoreNotification, "id" | "storeId" | "isRead" | "createdAt">
): Promise<StoreNotification> {
  const record: StoreNotification = {
    id: crypto.randomUUID(),
    storeId: DEMO_STORE_ID,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...notif,
  };

  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb.from("notifications").insert({
      id: record.id,
      store_id: record.storeId,
      severity: record.severity,
      title: record.title,
      message: record.message,
      link_path: record.linkPath ?? null,
      is_read: false,
      created_at: record.createdAt,
    });
    return record;
  }

  return withLocalDbTransaction((state) => {
    state.notifications.unshift(record);
    return record;
  });
}

export async function createProductRecord(
  input: {
    sku: string;
    name: string;
    barcode: string;
    category: string;
    sellingPrice: number;
    costPrice: number;
    availableQuantity: number;
    minStockThreshold: number;
    maxStockThreshold: number;
    aisleLocation: string;
    batchNumber: string;
    expiryDate: string;
    primarySupplierId: string;
  },
  actor: UserSession
): Promise<ProductWithInventory> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    const { error: prodErr } = await sb.from("products").insert({
      id,
      store_id: DEMO_STORE_ID,
      sku: input.sku,
      name: input.name,
      barcode: input.barcode,
      category: input.category,
      image_url: `/api/product-badge?sku=${encodeURIComponent(input.sku)}`,
      selling_price: input.sellingPrice,
      cost_price: input.costPrice,
      aisle_location: input.aisleLocation,
      batch_number: input.batchNumber,
      expiry_date: input.expiryDate,
      primary_supplier_id: input.primarySupplierId,
      is_synthetic: false,
    });
    if (prodErr) throw new Error(prodErr.message);

    const { error: invErr } = await sb.from("inventory").insert({
      store_id: DEMO_STORE_ID,
      product_id: id,
      available_quantity: input.availableQuantity,
      min_stock_threshold: input.minStockThreshold,
      max_stock_threshold: input.maxStockThreshold,
    });
    if (invErr) throw new Error(invErr.message);

    await addAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      eventCategory: "inventory",
      action: "product_created",
      entityType: "product",
      entityId: id,
      summary: `${actor.fullName} added ${input.name} (${input.sku}) with ${input.availableQuantity} units.`,
      details: input,
    });

    const state = await getFullState();
    return state.products.find((p) => p.id === id)!;
  }

  return withLocalDbTransaction((state) => {
    if (state.products.some((p) => p.sku === input.sku || p.barcode === input.barcode)) {
      throw new Error(`SKU ${input.sku} or barcode ${input.barcode} already exists.`);
    }
    const sup = state.suppliers.find((s) => s.id === input.primarySupplierId);
    const created: ProductWithInventory = {
      id,
      storeId: DEMO_STORE_ID,
      sku: input.sku,
      name: input.name,
      barcode: input.barcode,
      category: input.category,
      imageUrl: `/api/product-badge?sku=${encodeURIComponent(input.sku)}`,
      sellingPrice: input.sellingPrice,
      costPrice: input.costPrice,
      aisleLocation: input.aisleLocation,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate,
      primarySupplierId: input.primarySupplierId,
      supplierName: sup?.name ?? "Supplier",
      availableQuantity: input.availableQuantity,
      minStockThreshold: input.minStockThreshold,
      maxStockThreshold: input.maxStockThreshold,
      stockStatus: computeStockStatus(input.availableQuantity, input.minStockThreshold),
      lastCountedAt: now,
      isSynthetic: false,
    };
    state.products.push(created);
    state.auditLogs.unshift({
      id: crypto.randomUUID(),
      storeId: DEMO_STORE_ID,
      actorId: actor.id,
      actorRole: actor.role,
      eventCategory: "inventory",
      action: "product_created",
      entityType: "product",
      entityId: id,
      summary: `${actor.fullName} added ${input.name} (${input.sku}) with ${input.availableQuantity} units.`,
      details: input,
      createdAt: now,
    });
    return created;
  });
}

export async function updateProductRecord(
  id: string,
  patch: Partial<{
    name: string;
    category: string;
    sellingPrice: number;
    costPrice: number;
    aisleLocation: string;
    batchNumber: string;
    expiryDate: string;
    minStockThreshold: number;
    maxStockThreshold: number;
    availableQuantity: number;
    primarySupplierId: string;
  }>,
  actor: UserSession
): Promise<ProductWithInventory> {
  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    const prodPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) prodPatch.name = patch.name;
    if (patch.category !== undefined) prodPatch.category = patch.category;
    if (patch.sellingPrice !== undefined) prodPatch.selling_price = patch.sellingPrice;
    if (patch.costPrice !== undefined) prodPatch.cost_price = patch.costPrice;
    if (patch.aisleLocation !== undefined) prodPatch.aisle_location = patch.aisleLocation;
    if (patch.batchNumber !== undefined) prodPatch.batch_number = patch.batchNumber;
    if (patch.expiryDate !== undefined) prodPatch.expiry_date = patch.expiryDate;
    if (patch.primarySupplierId !== undefined) prodPatch.primary_supplier_id = patch.primarySupplierId;

    if (Object.keys(prodPatch).length > 1) {
      const { error } = await sb.from("products").update(prodPatch).eq("id", id);
      if (error) throw new Error(error.message);
    }

    const invPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.minStockThreshold !== undefined) invPatch.min_stock_threshold = patch.minStockThreshold;
    if (patch.maxStockThreshold !== undefined) invPatch.max_stock_threshold = patch.maxStockThreshold;
    if (Object.keys(invPatch).length > 1) {
      const { error } = await sb.from("inventory").update(invPatch).eq("product_id", id);
      if (error) throw new Error(error.message);
    }

    if (patch.availableQuantity !== undefined) {
      const { data: inv } = await sb.from("inventory").select("available_quantity").eq("product_id", id).single();
      const delta = patch.availableQuantity - (inv?.available_quantity ?? 0);
      if (delta !== 0) {
        await mutateInventory({
          productId: id,
          quantityDelta: delta,
          movementType: "adjustment",
          reason: `Manual inventory edit by ${actor.fullName}`,
          performedBy: actor.fullName,
        });
      }
    }

    await addAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      eventCategory: "inventory",
      action: "product_updated",
      entityType: "product",
      entityId: id,
      summary: `${actor.fullName} updated product ${id}.`,
      details: patch,
    });

    const state = await getFullState();
    return state.products.find((p) => p.id === id)!;
  }

  return withLocalDbTransaction((state) => {
    const prod = state.products.find((p) => p.id === id);
    if (!prod) throw new Error("Product not found");

    const oldQty = prod.availableQuantity;
    Object.assign(prod, patch);
    if (patch.primarySupplierId) {
      prod.supplierName =
        state.suppliers.find((s) => s.id === patch.primarySupplierId)?.name ?? prod.supplierName;
    }

    if (patch.availableQuantity !== undefined && patch.availableQuantity !== oldQty) {
      const delta = patch.availableQuantity - oldQty;
      prod.availableQuantity = oldQty; // applyAtomicInventoryDeltaInMemory computes new value
      applyAtomicInventoryDeltaInMemory(state, {
        productId: id,
        quantityDelta: delta,
        movementType: "adjustment",
        reason: `Manual inventory update by ${actor.fullName}`,
        performedBy: actor.fullName,
      });
    } else {
      prod.stockStatus = computeStockStatus(prod.availableQuantity, prod.minStockThreshold);
    }

    state.auditLogs.unshift({
      id: crypto.randomUUID(),
      storeId: DEMO_STORE_ID,
      actorId: actor.id,
      actorRole: actor.role,
      eventCategory: "inventory",
      action: "product_updated",
      entityType: "product",
      entityId: id,
      summary: `${actor.fullName} updated ${prod.name} (${prod.sku}).`,
      details: patch,
      createdAt: new Date().toISOString(),
    });
    return prod;
  });
}

export async function deleteProductRecord(id: string, actor: UserSession): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    const { data: prod } = await sb.from("products").select("sku, name").eq("id", id).single();
    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await addAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      eventCategory: "inventory",
      action: "product_deleted",
      entityType: "product",
      entityId: id,
      summary: `${actor.fullName} deleted ${prod?.name ?? id} (${prod?.sku ?? ""}).`,
      details: { id },
    });
    return;
  }

  await withLocalDbTransaction((state) => {
    const idx = state.products.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Product not found");
    const [removed] = state.products.splice(idx, 1);
    state.auditLogs.unshift({
      id: crypto.randomUUID(),
      storeId: DEMO_STORE_ID,
      actorId: actor.id,
      actorRole: actor.role,
      eventCategory: "inventory",
      action: "product_deleted",
      entityType: "product",
      entityId: id,
      summary: `${actor.fullName} deleted ${removed.name} (${removed.sku}).`,
      details: { sku: removed.sku },
      createdAt: new Date().toISOString(),
    });
  });
}

export async function saveVisionEvent(
  event: Omit<VisionEvent, "id" | "storeId" | "createdAt">
): Promise<VisionEvent> {
  const record: VisionEvent = {
    id: crypto.randomUUID(),
    storeId: DEMO_STORE_ID,
    createdAt: new Date().toISOString(),
    ...event,
  };

  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb.from("vision_events").insert({
      id: record.id,
      store_id: record.storeId,
      camera_id: record.cameraId,
      feed_mode: record.feedMode,
      event_type: record.eventType,
      product_id: record.productId ?? null,
      sku: record.sku ?? null,
      category: record.category ?? null,
      aisle: record.aisle ?? null,
      confidence_pct: record.confidencePct,
      shelf_occupancy_pct: record.shelfOccupancyPct ?? null,
      bounding_boxes: record.boundingBoxes,
      anomaly_flag: record.anomalyFlag,
      notes: record.notes ?? null,
      created_at: record.createdAt,
    });
    return record;
  }

  return withLocalDbTransaction((state) => {
    state.visionEvents.unshift(record);
    return record;
  });
}

export async function saveAgentMemoryRecord(
  mem: Omit<AgentMemoryRecord, "id" | "storeId" | "createdAt">
): Promise<AgentMemoryRecord> {
  const record: AgentMemoryRecord = {
    id: crypto.randomUUID(),
    storeId: DEMO_STORE_ID,
    createdAt: new Date().toISOString(),
    ...mem,
  };

  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb.from("agent_memory").insert({
      id: record.id,
      store_id: record.storeId,
      category: record.category,
      sku: record.sku ?? null,
      title: record.title,
      content: record.content,
      relevance_score: record.relevanceScore,
      influence_note: record.influenceNote ?? null,
      metadata: record.metadata ?? {},
      created_at: record.createdAt,
    });
    return record;
  }

  return withLocalDbTransaction((state) => {
    state.agentMemory.unshift(record);
    return record;
  });
}

export async function saveAgentRunAndTools(
  run: AgentRun,
  toolExecutions: AgentToolExecution[]
): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb.from("agent_runs").upsert({
      id: run.id,
      store_id: run.storeId,
      objective: run.objective,
      trigger_source: run.triggerSource,
      planner_mode: run.plannerMode,
      status: run.status,
      reasoning_summary: run.reasoningSummary,
      planned_actions: run.plannedActions,
      steps: run.steps,
      final_summary: run.finalSummary ?? null,
      created_at: run.createdAt,
      completed_at: run.completedAt ?? null,
    });
    if (toolExecutions.length > 0) {
      await sb.from("agent_tool_executions").upsert(
        toolExecutions.map((t) => ({
          id: t.id,
          agent_run_id: t.agentRunId,
          tool_name: t.toolName,
          input_args: t.inputArgs,
          execution_status: t.executionStatus,
          result: t.result ?? null,
          error_details: t.errorDetails ?? null,
          created_at: t.createdAt,
        }))
      );
    }
    return;
  }

  await withLocalDbTransaction((state) => {
    const existingIdx = state.agentRuns.findIndex((r) => r.id === run.id);
    if (existingIdx >= 0) {
      state.agentRuns[existingIdx] = run;
    } else {
      state.agentRuns.unshift(run);
    }
    for (const te of toolExecutions) {
      if (!state.agentToolExecutions.some((e) => e.id === te.id)) {
        state.agentToolExecutions.unshift(te);
      }
    }
  });
}

export async function savePurchaseOrderRecord(po: PurchaseOrder): Promise<PurchaseOrder> {
  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb.from("purchase_orders").insert({
      id: po.id,
      po_number: po.poNumber,
      store_id: po.storeId,
      supplier_id: po.supplierId,
      status: po.status,
      total_value: po.totalValue,
      estimated_lead_time_days: po.estimatedLeadTimeDays,
      reason: po.reason,
      created_by: po.createdBy,
      approved_by: po.approvedBy ?? null,
      idempotency_key: po.idempotencyKey ?? null,
      created_at: po.createdAt,
      updated_at: po.updatedAt,
    });
    await sb.from("purchase_order_items").insert(
      po.items.map((it) => ({
        id: it.id,
        purchase_order_id: po.id,
        product_id: it.productId,
        ordered_quantity: it.orderedQuantity,
        unit_cost: it.unitCost,
        line_total: it.lineTotal,
      }))
    );
    return po;
  }

  return withLocalDbTransaction((state) => {
    if (po.idempotencyKey) {
      const existing = state.purchaseOrders.find((p) => p.idempotencyKey === po.idempotencyKey);
      if (existing) return existing;
    }
    state.purchaseOrders.unshift(po);
    return po;
  });
}

export async function saveApprovalRequestRecord(req: ApprovalRequest): Promise<ApprovalRequest> {
  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb.from("approval_requests").insert({
      id: req.id,
      store_id: req.storeId,
      agent_run_id: req.agentRunId ?? null,
      action_type: req.actionType,
      product_id: req.productId ?? null,
      sku: req.sku ?? null,
      reference_id: req.referenceId,
      proposed_change: req.proposedChange,
      financial_impact: req.financialImpact,
      agent_explanation: req.agentExplanation,
      evidence: req.evidence,
      risk_level: req.riskLevel,
      status: req.status,
      payload: req.payload,
      idempotency_key: req.idempotencyKey ?? null,
      created_at: req.createdAt,
      updated_at: req.updatedAt,
    });
    return req;
  }

  return withLocalDbTransaction((state) => {
    if (req.idempotencyKey) {
      const existing = state.approvalRequests.find((a) => a.idempotencyKey === req.idempotencyKey);
      if (existing) return existing;
    }
    state.approvalRequests.unshift(req);
    return req;
  });
}

export async function saveCheckoutAndDispute(
  session: CheckoutSession,
  dispute?: CheckoutDispute | null
): Promise<void> {
  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb.from("checkout_sessions").insert({
      id: session.id,
      session_code: session.sessionCode,
      store_id: session.storeId,
      cashier_id: session.cashierId,
      camera_id: session.cameraId,
      status: session.status,
      visual_confidence: session.visualConfidence,
      subtotal: session.subtotal,
      gst_amount: session.gstAmount,
      total_amount: session.totalAmount,
      anomaly_reason: session.anomalyReason ?? null,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
    });
    await sb.from("checkout_items").insert(
      session.items.map((it) => ({
        id: it.id,
        checkout_session_id: session.id,
        product_id: it.productId ?? null,
        sku: it.sku,
        product_name: it.productName,
        scanned_barcode: it.scannedBarcode ?? null,
        expected_price: it.expectedPrice,
        pos_price: it.posPrice,
        quantity: it.quantity,
        visual_confidence: it.visualConfidence,
        match_status: it.matchStatus,
      }))
    );
    if (dispute) {
      await sb.from("checkout_disputes").insert({
        id: dispute.id,
        store_id: dispute.storeId,
        checkout_session_id: dispute.checkoutSessionId,
        dispute_type: dispute.disputeType,
        description: dispute.description,
        evidence: dispute.evidence,
        status: dispute.status,
        created_at: dispute.createdAt,
        updated_at: dispute.updatedAt,
      });
    }
    return;
  }

  await withLocalDbTransaction((state) => {
    state.checkoutSessions.unshift(session);
    if (dispute) state.checkoutDisputes.unshift(dispute);
  });
}

export async function savePriceRecommendationRecord(
  rec: PriceRecommendation
): Promise<PriceRecommendation> {
  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb.from("price_recommendations").insert({
      id: rec.id,
      store_id: rec.storeId,
      product_id: rec.productId,
      sku: rec.sku,
      original_price: rec.originalPrice,
      recommended_price: rec.recommendedPrice,
      discount_pct: rec.discountPct,
      expiry_risk: rec.expiryRisk,
      expected_impact: rec.expectedImpact,
      reason: rec.reason,
      requires_approval: rec.requiresApproval,
      status: rec.status,
      created_at: rec.createdAt,
    });
    return rec;
  }

  return withLocalDbTransaction((state) => {
    state.priceRecommendations.unshift(rec);
    return rec;
  });
}

export async function decideApprovalRequest(params: {
  requestId: string;
  decision: "approved" | "rejected" | "changes_requested";
  notes: string;
  actor: UserSession;
}): Promise<{
  request: ApprovalRequest;
  decisionRecord: ApprovalDecision;
  executionResult: Record<string, unknown>;
}> {
  const allowedRoles: UserRole[] = ["store_owner", "store_manager"];
  if (!allowedRoles.includes(params.actor.role)) {
    throw new Error(
      `Authorization error: role '${params.actor.role}' cannot approve or reject sensitive operations.`
    );
  }

  const state = await getFullState();
  const req = state.approvalRequests.find((r) => r.id === params.requestId);
  if (!req) throw new Error("Approval request not found.");
  if (req.status !== "pending" && req.status !== "changes_requested") {
    throw new Error(`Approval request is already '${req.status}' and cannot be re-executed.`);
  }

  let executionResult: Record<string, unknown> = { status: params.decision };
  const now = new Date().toISOString();

  if (params.decision === "approved") {
    if (req.actionType === "supplier_po_dispatch") {
      const poId = String(req.payload.purchaseOrderId || req.referenceId);
      const po = state.purchaseOrders.find((p) => p.id === poId);
      if (!po) throw new Error(`Referenced Purchase Order ${poId} not found.`);
      if (isSupabaseConfigured()) {
        const sb = createSupabaseAdminClient();
        await sb
          .from("purchase_orders")
          .update({ status: "dispatched", approved_by: params.actor.fullName, updated_at: now })
          .eq("id", poId);
      } else {
        await withLocalDbTransaction((s) => {
          const target = s.purchaseOrders.find((p) => p.id === poId);
          if (target) {
            target.status = "dispatched";
            target.approvedBy = params.actor.fullName;
            target.updatedAt = now;
          }
        });
      }
      executionResult = {
        executedAction: "purchase_order_dispatched",
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        totalValue: po.totalValue,
      };
    } else if (req.actionType === "checkout_dispute_override") {
      const productId = String(req.payload.productId || req.productId || "");
      const checkoutSessionId = String(req.payload.checkoutSessionId || "");
      const disputeId = String(req.payload.disputeId || req.referenceId);

      if (productId) {
        const mut = await mutateInventory({
          productId,
          quantityDelta: -1,
          movementType: "sale_deduction",
          reason: `Manager-approved checkout override (${params.actor.fullName})`,
          referenceType: "approval_request",
          referenceId: req.id,
          idempotencyKey: `approval-exec-${req.id}`,
          performedBy: params.actor.fullName,
        });
        executionResult = { executedAction: "checkout_override_and_deduct", ...mut };
      }

      if (isSupabaseConfigured()) {
        const sb = createSupabaseAdminClient();
        await sb
          .from("checkout_disputes")
          .update({
            status: "resolved_override",
            resolved_by: params.actor.fullName,
            resolution_notes: params.notes || "Approved by Store Manager",
            updated_at: now,
          })
          .eq("id", disputeId);
        if (checkoutSessionId) {
          await sb
            .from("checkout_sessions")
            .update({ status: "completed", updated_at: now })
            .eq("id", checkoutSessionId);
        }
      } else {
        await withLocalDbTransaction((s) => {
          const d = s.checkoutDisputes.find((x) => x.id === disputeId);
          if (d) {
            d.status = "resolved_override";
            d.resolvedBy = params.actor.fullName;
            d.resolutionNotes = params.notes || "Approved by Store Manager";
            d.updatedAt = now;
          }
          const cs = s.checkoutSessions.find((x) => x.id === checkoutSessionId);
          if (cs) {
            cs.status = "completed";
            cs.updatedAt = now;
          }
        });
      }
    } else if (req.actionType === "high_impact_price_change") {
      const productId = String(req.payload.productId || req.productId || "");
      const newPrice = Number(req.payload.newPrice);
      const recId = String(req.payload.recommendationId || req.referenceId);
      const prod = state.products.find((p) => p.id === productId);
      if (!prod || !Number.isFinite(newPrice)) {
        throw new Error("Invalid pricing payload on approval request.");
      }

      if (isSupabaseConfigured()) {
        const sb = createSupabaseAdminClient();
        await sb.from("products").update({ selling_price: newPrice, updated_at: now }).eq("id", productId);
        await sb.from("price_recommendations").update({ status: "applied" }).eq("id", recId);
      } else {
        await withLocalDbTransaction((s) => {
          const targetProd = s.products.find((p) => p.id === productId);
          if (targetProd) targetProd.sellingPrice = newPrice;
          const rec = s.priceRecommendations.find((r) => r.id === recId);
          if (rec) rec.status = "applied";
        });
      }
      executionResult = {
        executedAction: "price_markdown_applied",
        sku: prod.sku,
        previousPrice: prod.sellingPrice,
        newPrice,
      };
    } else if (req.actionType === "inventory_adjustment") {
      const productId = String(req.payload.productId || req.productId || "");
      const delta = Number(req.payload.quantityDelta || 0);
      const mut = await mutateInventory({
        productId,
        quantityDelta: delta,
        movementType: "adjustment",
        reason: `Approved large adjustment by ${params.actor.fullName}`,
        referenceType: "approval_request",
        referenceId: req.id,
        idempotencyKey: `approval-adj-${req.id}`,
        performedBy: params.actor.fullName,
      });
      executionResult = { executedAction: "inventory_adjustment_applied", ...mut };
    }
  } else if (params.decision === "rejected") {
    executionResult = {
      executedAction: "rejected_preserved_state",
      alternativeRecommendation:
        req.actionType === "supplier_po_dispatch"
          ? "Consider reducing order quantity to MOQ or splitting delivery across suppliers."
          : "Maintain current store data and flag Cashier/Supervisor for physical shelf count.",
    };
  }

  const decisionRecord: ApprovalDecision = {
    id: crypto.randomUUID(),
    approvalRequestId: req.id,
    decidedByUserId: params.actor.id,
    decidedByName: params.actor.fullName,
    decidedByRole: params.actor.role,
    decision: params.decision,
    notes: params.notes,
    executionResult,
    createdAt: now,
  };

  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    await sb
      .from("approval_requests")
      .update({ status: params.decision, updated_at: now })
      .eq("id", req.id);
    await sb.from("approval_decisions").insert({
      id: decisionRecord.id,
      approval_request_id: decisionRecord.approvalRequestId,
      decided_by_user_id: decisionRecord.decidedByUserId,
      decided_by_name: decisionRecord.decidedByName,
      decided_by_role: decisionRecord.decidedByRole,
      decision: decisionRecord.decision,
      notes: decisionRecord.notes ?? null,
      execution_result: decisionRecord.executionResult ?? null,
      created_at: now,
    });
    if (req.agentRunId) {
      await sb
        .from("agent_runs")
        .update({ status: "completed", completed_at: now })
        .eq("id", req.agentRunId);
    }
  } else {
    await withLocalDbTransaction((s) => {
      const target = s.approvalRequests.find((r) => r.id === req.id);
      if (target) {
        target.status = params.decision;
        target.updatedAt = now;
      }
      s.approvalDecisions.unshift(decisionRecord);
      if (req.agentRunId) {
        const run = s.agentRuns.find((r) => r.id === req.agentRunId);
        if (run) {
          run.status = "completed";
          run.completedAt = now;
          run.steps.push({
            id: crypto.randomUUID(),
            phase: "REMEMBER",
            title: `Manager ${params.decision.toUpperCase()} Decision Recorded`,
            detail: `${params.actor.fullName} (${params.actor.role}) ${params.decision} request ${req.id}. ${params.notes || ""}`,
            timestamp: now,
            status: "completed",
          });
        }
      }
    });
  }

  // Record in persistent agent memory & audit log
  await saveAgentMemoryRecord({
    category: "operational",
    sku: req.sku ?? null,
    title: `Manager ${params.decision}: ${req.actionType}`,
    content: `${params.actor.fullName} ${params.decision} ${req.proposedChange}. Notes: ${params.notes || "None"}.`,
    relevanceScore: 0.92,
    influenceNote: `Future agent proposals for ${req.actionType} will reference this authorization outcome.`,
  });

  await addAuditLog({
    actorId: params.actor.id,
    actorRole: params.actor.role,
    eventCategory: "approval",
    action: `approval_${params.decision}`,
    entityType: "approval_request",
    entityId: req.id,
    summary: `${params.actor.fullName} ${params.decision} ${req.actionType} (${req.sku || req.referenceId}).`,
    details: { notes: params.notes, executionResult },
  });

  const updatedState = await getFullState();
  const updatedReq = updatedState.approvalRequests.find((r) => r.id === req.id)!;
  return { request: updatedReq, decisionRecord, executionResult };
}

export async function updatePricingRulesRecord(
  patch: Partial<PricingRules>,
  actor: UserSession
): Promise<PricingRules> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const sb = createSupabaseAdminClient();
    const { error } = await sb
      .from("pricing_rules")
      .update({
        min_margin_pct: patch.minMarginPct,
        auto_approve_max_discount_pct: patch.autoApproveMaxDiscountPct,
        expiry_alert_window_days: patch.expiryAlertWindowDays,
        po_auto_approve_limit: patch.poAutoApproveLimit,
        inventory_adjust_approval_threshold: patch.inventoryAdjustApprovalThreshold,
        updated_at: now,
      })
      .eq("store_id", DEMO_STORE_ID);
    if (error) throw new Error(error.message);
    await addAuditLog({
      actorId: actor.id,
      actorRole: actor.role,
      eventCategory: "settings",
      action: "pricing_rules_updated",
      entityType: "pricing_rules",
      entityId: DEMO_STORE_ID,
      summary: `${actor.fullName} updated pricing & approval governance rules.`,
      details: patch,
    });
    const state = await getFullState();
    return state.pricingRules;
  }

  return withLocalDbTransaction((state) => {
    Object.assign(state.pricingRules, patch, { updatedAt: now });
    state.auditLogs.unshift({
      id: crypto.randomUUID(),
      storeId: DEMO_STORE_ID,
      actorId: actor.id,
      actorRole: actor.role,
      eventCategory: "settings",
      action: "pricing_rules_updated",
      entityType: "pricing_rules",
      entityId: state.pricingRules.id,
      summary: `${actor.fullName} updated pricing & approval governance rules.`,
      details: patch,
      createdAt: now,
    });
    return state.pricingRules;
  });
}

export async function resetDemoState(actor: UserSession): Promise<DatabaseState> {
  if (isSupabaseConfigured()) {
    // In Supabase mode, avoid destructive wipe without explicit confirmation; reset only demo items or inform user
    throw new Error(
      "Connected Supabase database active: use the SQL seed script to reset production tables, or switch to Simulation Mode."
    );
  }
  const fresh = await resetLocalDbToSeed();
  await addAuditLog({
    actorId: actor.id,
    actorRole: actor.role,
    eventCategory: "demo",
    action: "demo_store_reset",
    entityType: "store",
    entityId: DEMO_STORE_ID,
    summary: `${actor.fullName} reset Retail Demo Market – Store 01 back to initial synthetic baseline.`,
    details: {},
  });
  return fresh;
}

