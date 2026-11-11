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
  ProductWithInventory,
  PurchaseOrder,
  StoreNotification,
  Supplier,
  VisionEvent,
} from "@/types/retailens";

export async function loadFullStateFromSupabase(): Promise<DatabaseState> {
  const sb = createSupabaseAdminClient();
  const [
    storeRes,
    profilesRes,
    suppliersRes,
    productsRes,
    inventoryRes,
    movementsRes,
    supplierProductsRes,
    posRes,
    poItemsRes,
    checkoutsRes,
    checkoutItemsRes,
    disputesRes,
    visionRes,
    runsRes,
    toolsRes,
    memoryRes,
    approvalsRes,
    decisionsRes,
    rulesRes,
    priceRecsRes,
    auditsRes,
    notifsRes,
  ] = await Promise.all([
    sb.from("stores").select("*").eq("id", DEMO_STORE_ID).single(),
    sb.from("profiles").select("*"),
    sb.from("suppliers").select("*").order("name"),
    sb.from("products").select("*").order("sku"),
    sb.from("inventory").select("*"),
    sb.from("inventory_movements").select("*").order("created_at", { ascending: false }).limit(100),
    sb.from("supplier_products").select("*"),
    sb.from("purchase_orders").select("*").order("created_at", { ascending: false }),
    sb.from("purchase_order_items").select("*"),
    sb.from("checkout_sessions").select("*").order("created_at", { ascending: false }).limit(50),
    sb.from("checkout_items").select("*"),
    sb.from("checkout_disputes").select("*").order("created_at", { ascending: false }),
    sb.from("vision_events").select("*").order("created_at", { ascending: false }).limit(50),
    sb.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(30),
    sb.from("agent_tool_executions").select("*").order("created_at", { ascending: false }).limit(100),
    sb.from("agent_memory").select("*").order("created_at", { ascending: false }).limit(100),
    sb.from("approval_requests").select("*").order("created_at", { ascending: false }),
    sb.from("approval_decisions").select("*").order("created_at", { ascending: false }),
    sb.from("pricing_rules").select("*").eq("store_id", DEMO_STORE_ID).single(),
    sb.from("price_recommendations").select("*").order("created_at", { ascending: false }),
    sb.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
    sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  if (storeRes.error) {
    throw new Error(`Supabase store load failed: ${storeRes.error.message}`);
  }

  const invByProd = new Map((inventoryRes.data ?? []).map((i) => [i.product_id, i]));
  const supNameById = new Map((suppliersRes.data ?? []).map((s) => [s.id, s.name]));

  const products: ProductWithInventory[] = (productsRes.data ?? []).map((p) => {
    const inv = invByProd.get(p.id);
    const qty = inv?.available_quantity ?? 0;
    const min = inv?.min_stock_threshold ?? 10;
    return {
      id: p.id,
      storeId: p.store_id,
      sku: p.sku,
      name: p.name,
      barcode: p.barcode,
      category: p.category,
      imageUrl: p.image_url || `/api/product-badge?sku=${encodeURIComponent(p.sku)}`,
      sellingPrice: Number(p.selling_price),
      costPrice: Number(p.cost_price),
      aisleLocation: p.aisle_location,
      batchNumber: p.batch_number,
      expiryDate: String(p.expiry_date),
      primarySupplierId: p.primary_supplier_id,
      supplierName: supNameById.get(p.primary_supplier_id) ?? "Supplier",
      availableQuantity: qty,
      minStockThreshold: min,
      maxStockThreshold: inv?.max_stock_threshold ?? 100,
      stockStatus: computeStockStatus(qty, min),
      lastCountedAt: inv?.last_counted_at ?? p.updated_at,
      isSynthetic: Boolean(p.is_synthetic),
    };
  });

  const prodById = new Map(products.map((p) => [p.id, p]));

  const suppliers: Supplier[] = (suppliersRes.data ?? []).map((s) => ({
    id: s.id,
    storeId: s.store_id,
    name: s.name,
    contactName: s.contact_name,
    contactEmail: s.contact_email,
    contactPhone: s.contact_phone,
    avgLeadTimeDays: s.avg_lead_time_days,
    minOrderQuantity: s.min_order_quantity,
    fulfillmentRatePct: Number(s.fulfillment_rate_pct),
    status: s.status,
    apiEndpointStatus: s.api_endpoint_status,
    isSynthetic: Boolean(s.is_synthetic),
  }));

  const inventoryMovements: InventoryMovement[] = (movementsRes.data ?? []).map((m) => {
    const prod = prodById.get(m.product_id);
    return {
      id: m.id,
      storeId: m.store_id,
      productId: m.product_id,
      sku: prod?.sku ?? "",
      productName: prod?.name ?? "Product",
      movementType: m.movement_type,
      quantityDelta: m.quantity_delta,
      quantityBefore: m.quantity_before,
      quantityAfter: m.quantity_after,
      reason: m.reason,
      referenceType: m.reference_type,
      referenceId: m.reference_id,
      idempotencyKey: m.idempotency_key,
      performedBy: m.performed_by,
      createdAt: m.created_at,
    };
  });

  const poItemsByPo = new Map<string, typeof poItemsRes.data>();
  for (const item of poItemsRes.data ?? []) {
    const list = poItemsByPo.get(item.purchase_order_id) ?? [];
    list.push(item);
    poItemsByPo.set(item.purchase_order_id, list);
  }

  const purchaseOrders: PurchaseOrder[] = (posRes.data ?? []).map((po) => ({
    id: po.id,
    poNumber: po.po_number,
    storeId: po.store_id,
    supplierId: po.supplier_id,
    supplierName: supNameById.get(po.supplier_id) ?? "Supplier",
    status: po.status,
    totalValue: Number(po.total_value),
    estimatedLeadTimeDays: po.estimated_lead_time_days,
    reason: po.reason,
    createdBy: po.created_by,
    approvedBy: po.approved_by,
    idempotencyKey: po.idempotency_key,
    items: (poItemsByPo.get(po.id) ?? []).map((it) => {
      const prod = prodById.get(it.product_id);
      return {
        id: it.id,
        purchaseOrderId: it.purchase_order_id,
        productId: it.product_id,
        sku: prod?.sku ?? "",
        productName: prod?.name ?? "Product",
        orderedQuantity: it.ordered_quantity,
        unitCost: Number(it.unit_cost),
        lineTotal: Number(it.line_total),
      };
    }),
    createdAt: po.created_at,
    updatedAt: po.updated_at,
  }));

  const chkItemsBySession = new Map<string, typeof checkoutItemsRes.data>();
  for (const item of checkoutItemsRes.data ?? []) {
    const list = chkItemsBySession.get(item.checkout_session_id) ?? [];
    list.push(item);
    chkItemsBySession.set(item.checkout_session_id, list);
  }

  const checkoutSessions: CheckoutSession[] = (checkoutsRes.data ?? []).map((c) => ({
    id: c.id,
    sessionCode: c.session_code,
    storeId: c.store_id,
    cashierId: c.cashier_id,
    cameraId: c.camera_id,
    status: c.status,
    visualConfidence: Number(c.visual_confidence),
    subtotal: Number(c.subtotal),
    gstAmount: Number(c.gst_amount),
    totalAmount: Number(c.total_amount),
    anomalyReason: c.anomaly_reason,
    items: (chkItemsBySession.get(c.id) ?? []).map((it) => ({
      id: it.id,
      checkoutSessionId: it.checkout_session_id,
      productId: it.product_id,
      sku: it.sku,
      productName: it.product_name,
      scannedBarcode: it.scanned_barcode,
      expectedPrice: Number(it.expected_price),
      posPrice: Number(it.pos_price),
      quantity: it.quantity,
      visualConfidence: Number(it.visual_confidence),
      matchStatus: it.match_status,
    })),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  const sessionCodeById = new Map(checkoutSessions.map((c) => [c.id, c.sessionCode]));

  const checkoutDisputes: CheckoutDispute[] = (disputesRes.data ?? []).map((d) => ({
    id: d.id,
    storeId: d.store_id,
    checkoutSessionId: d.checkout_session_id,
    sessionCode: sessionCodeById.get(d.checkout_session_id) ?? d.checkout_session_id,
    disputeType: d.dispute_type,
    description: d.description,
    evidence: d.evidence ?? {},
    status: d.status,
    resolutionNotes: d.resolution_notes,
    resolvedBy: d.resolved_by,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));

  const visionEvents: VisionEvent[] = (visionRes.data ?? []).map((v) => ({
    id: v.id,
    storeId: v.store_id,
    cameraId: v.camera_id,
    feedMode: v.feed_mode,
    eventType: v.event_type,
    productId: v.product_id,
    sku: v.sku,
    productName: v.product_id ? prodById.get(v.product_id)?.name : undefined,
    category: v.category,
    aisle: v.aisle,
    confidencePct: Number(v.confidence_pct),
    shelfOccupancyPct: v.shelf_occupancy_pct !== null ? Number(v.shelf_occupancy_pct) : null,
    boundingBoxes: v.bounding_boxes ?? [],
    anomalyFlag: Boolean(v.anomaly_flag),
    notes: v.notes,
    createdAt: v.created_at,
  }));

  const agentRuns: AgentRun[] = (runsRes.data ?? []).map((r) => ({
    id: r.id,
    storeId: r.store_id,
    objective: r.objective,
    triggerSource: r.trigger_source,
    plannerMode: r.planner_mode,
    status: r.status,
    reasoningSummary: r.reasoning_summary ?? "",
    plannedActions: r.planned_actions ?? [],
    steps: r.steps ?? [],
    finalSummary: r.final_summary,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  }));

  const agentToolExecutions: AgentToolExecution[] = (toolsRes.data ?? []).map((t) => ({
    id: t.id,
    agentRunId: t.agent_run_id,
    toolName: t.tool_name,
    inputArgs: t.input_args ?? {},
    executionStatus: t.execution_status,
    result: t.result,
    errorDetails: t.error_details,
    createdAt: t.created_at,
  }));

  const agentMemory: AgentMemoryRecord[] = (memoryRes.data ?? []).map((m) => ({
    id: m.id,
    storeId: m.store_id,
    category: m.category,
    sku: m.sku,
    title: m.title,
    content: m.content,
    relevanceScore: Number(m.relevance_score),
    influenceNote: m.influence_note,
    metadata: m.metadata ?? {},
    createdAt: m.created_at,
  }));

  const approvalRequests: ApprovalRequest[] = (approvalsRes.data ?? []).map((a) => ({
    id: a.id,
    storeId: a.store_id,
    agentRunId: a.agent_run_id,
    actionType: a.action_type,
    productId: a.product_id,
    sku: a.sku,
    productName: a.product_id ? prodById.get(a.product_id)?.name : undefined,
    referenceId: a.reference_id,
    proposedChange: a.proposed_change,
    financialImpact: Number(a.financial_impact),
    agentExplanation: a.agent_explanation,
    evidence: a.evidence ?? {},
    riskLevel: a.risk_level,
    status: a.status,
    payload: a.payload ?? {},
    idempotencyKey: a.idempotency_key,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }));

  const approvalDecisions: ApprovalDecision[] = (decisionsRes.data ?? []).map((d) => ({
    id: d.id,
    approvalRequestId: d.approval_request_id,
    decidedByUserId: d.decided_by_user_id,
    decidedByName: d.decided_by_name,
    decidedByRole: d.decided_by_role,
    decision: d.decision,
    notes: d.notes,
    executionResult: d.execution_result,
    createdAt: d.created_at,
  }));

  const priceRecommendations: PriceRecommendation[] = (priceRecsRes.data ?? []).map((pr) => ({
    id: pr.id,
    storeId: pr.store_id,
    productId: pr.product_id,
    sku: pr.sku,
    productName: prodById.get(pr.product_id)?.name ?? pr.sku,
    originalPrice: Number(pr.original_price),
    recommendedPrice: Number(pr.recommended_price),
    discountPct: Number(pr.discount_pct),
    expiryRisk: pr.expiry_risk,
    expectedImpact: pr.expected_impact,
    reason: pr.reason,
    requiresApproval: Boolean(pr.requires_approval),
    status: pr.status,
    createdAt: pr.created_at,
  }));

  const auditLogs: AuditLog[] = (auditsRes.data ?? []).map((al) => ({
    id: al.id,
    storeId: al.store_id,
    actorId: al.actor_id,
    actorRole: al.actor_role,
    eventCategory: al.event_category,
    action: al.action,
    entityType: al.entity_type,
    entityId: al.entity_id,
    summary: al.summary,
    details: al.details ?? {},
    createdAt: al.created_at,
  }));

  const notifications: StoreNotification[] = (notifsRes.data ?? []).map((n) => ({
    id: n.id,
    storeId: n.store_id,
    severity: n.severity,
    title: n.title,
    message: n.message,
    linkPath: n.link_path,
    isRead: Boolean(n.is_read),
    createdAt: n.created_at,
  }));

  const storeData = storeRes.data;
  const rulesData = rulesRes.data;

  return {
    store: {
      id: storeData.id,
      code: storeData.code,
      name: storeData.name,
      location: storeData.location,
      timezone: storeData.timezone,
      gstRatePct: Number(storeData.gst_rate_pct),
      operationalStatus: storeData.operational_status,
      isDemoSynthetic: Boolean(storeData.is_demo_synthetic),
    },
    profiles: (profilesRes.data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      fullName: p.full_name,
      role: p.role,
      storeId: p.store_id,
    })),
    suppliers,
    products,
    inventoryMovements,
    supplierProducts: (supplierProductsRes.data ?? []).map((sp) => ({
      id: sp.id,
      supplierId: sp.supplier_id,
      productId: sp.product_id,
      supplierSku: sp.supplier_sku,
      unitCost: Number(sp.unit_cost),
      leadTimeDays: sp.lead_time_days,
      moq: sp.moq,
    })),
    purchaseOrders,
    checkoutSessions,
    checkoutDisputes,
    visionEvents,
    agentRuns,
    agentToolExecutions,
    agentMemory,
    approvalRequests,
    approvalDecisions,
    pricingRules: rulesData
      ? {
          id: rulesData.id,
          storeId: rulesData.store_id,
          minMarginPct: Number(rulesData.min_margin_pct),
          autoApproveMaxDiscountPct: Number(rulesData.auto_approve_max_discount_pct),
          expiryAlertWindowDays: rulesData.expiry_alert_window_days,
          poAutoApproveLimit: Number(rulesData.po_auto_approve_limit),
          inventoryAdjustApprovalThreshold: rulesData.inventory_adjust_approval_threshold,
          updatedAt: rulesData.updated_at,
        }
      : {
          id: "90909090-9090-4909-8909-909090909001",
          storeId: DEMO_STORE_ID,
          minMarginPct: 10,
          autoApproveMaxDiscountPct: 15,
          expiryAlertWindowDays: 10,
          poAutoApproveLimit: 5000,
          inventoryAdjustApprovalThreshold: 10,
          updatedAt: new Date().toISOString(),
        },
    priceRecommendations,
    auditLogs,
    notifications,
  };
}

