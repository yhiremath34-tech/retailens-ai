export type UserRole = "store_owner" | "store_manager" | "inventory_manager" | "cashier";

export interface UserSession {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  storeId: string;
  authMode: "supabase" | "simulation";
}

export interface StoreConfig {
  id: string;
  code: string;
  name: string;
  location: string;
  timezone: string;
  gstRatePct: number;
  operationalStatus: "active" | "maintenance" | "closed";
  isDemoSynthetic: boolean;
}

export interface Supplier {
  id: string;
  storeId: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  avgLeadTimeDays: number;
  minOrderQuantity: number;
  fulfillmentRatePct: number;
  status: "active" | "paused" | "onboarding";
  apiEndpointStatus: "mock_interface" | "connected";
  isSynthetic: boolean;
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface ProductWithInventory {
  id: string;
  storeId: string;
  sku: string;
  name: string;
  barcode: string;
  category: string;
  imageUrl: string;
  sellingPrice: number;
  costPrice: number;
  aisleLocation: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  primarySupplierId: string;
  supplierName?: string;
  availableQuantity: number;
  minStockThreshold: number;
  maxStockThreshold: number;
  stockStatus: StockStatus;
  lastCountedAt: string;
  isSynthetic: boolean;
}

export interface InventoryMovement {
  id: string;
  storeId: string;
  productId: string;
  sku: string;
  productName: string;
  movementType: "sale_deduction" | "restock" | "adjustment" | "expiry_writeoff" | "return";
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  performedBy: string;
  createdAt: string;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;
  supplierSku: string;
  unitCost: number;
  leadTimeDays: number;
  moq: number;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  sku: string;
  productName: string;
  orderedQuantity: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  storeId: string;
  supplierId: string;
  supplierName: string;
  status: "draft" | "pending_approval" | "approved" | "dispatched" | "received" | "rejected" | "cancelled";
  totalValue: number;
  estimatedLeadTimeDays: number;
  reason: string;
  createdBy: string;
  approvedBy?: string | null;
  idempotencyKey?: string;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutItem {
  id: string;
  checkoutSessionId: string;
  productId?: string | null;
  sku: string;
  productName: string;
  scannedBarcode?: string | null;
  expectedPrice: number;
  posPrice: number;
  quantity: number;
  visualConfidence: number;
  matchStatus:
    | "matched"
    | "barcode_mismatch"
    | "price_discrepancy"
    | "duplicate_scan"
    | "missing_scan"
    | "low_confidence";
}

export interface CheckoutSession {
  id: string;
  sessionCode: string;
  storeId: string;
  cashierId: string;
  cameraId: string;
  status: "active" | "verified" | "paused_review" | "disputed" | "completed" | "cancelled";
  visualConfidence: number;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  anomalyReason?: string | null;
  items: CheckoutItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutDispute {
  id: string;
  storeId: string;
  checkoutSessionId: string;
  sessionCode: string;
  disputeType:
    | "barcode_mismatch"
    | "price_discrepancy"
    | "duplicate_scan"
    | "missing_scan"
    | "low_confidence";
  description: string;
  evidence: Record<string, unknown>;
  status: "open" | "pending_approval" | "resolved_override" | "resolved_dismissed";
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoundingBox {
  label: string;
  sku: string;
  confidence: number;
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  width: number; // percentage
  height: number; // percentage
  status: "ok" | "low_stock" | "stockout" | "anomaly";
}

export interface VisionEvent {
  id: string;
  storeId: string;
  cameraId: string;
  feedMode: "demo" | "connected" | "upload";
  eventType:
    | "shelf_scan"
    | "stockout_detected"
    | "low_stock_detected"
    | "checkout_scan"
    | "anomaly_detected";
  productId?: string | null;
  sku?: string | null;
  productName?: string | null;
  category?: string | null;
  aisle?: string | null;
  confidencePct: number;
  shelfOccupancyPct?: number | null;
  boundingBoxes: BoundingBox[];
  anomalyFlag: boolean;
  notes?: string | null;
  createdAt: string;
}

export type AgentPhase = "PERCEIVE" | "REASON" | "PLAN" | "ACT" | "OBSERVE" | "REMEMBER";

export interface AgentStep {
  id: string;
  phase: AgentPhase;
  title: string;
  detail: string;
  timestamp: string;
  toolName?: string;
  status: "completed" | "awaiting_approval" | "blocked" | "failed";
}

export interface AgentRun {
  id: string;
  storeId: string;
  objective: string;
  triggerSource: string;
  plannerMode: "gemini" | "deterministic";
  status: "running" | "awaiting_approval" | "completed" | "failed";
  reasoningSummary: string;
  plannedActions: string[];
  steps: AgentStep[];
  finalSummary?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface AgentToolExecution {
  id: string;
  agentRunId: string;
  toolName: string;
  inputArgs: Record<string, unknown>;
  executionStatus: "validated" | "executed" | "blocked" | "awaiting_approval" | "failed";
  result?: Record<string, unknown> | null;
  errorDetails?: string | null;
  createdAt: string;
}

export type MemoryCategory = "inventory" | "supplier" | "checkout" | "pricing" | "operational";

export interface AgentMemoryRecord {
  id: string;
  storeId: string;
  category: MemoryCategory;
  sku?: string | null;
  title: string;
  content: string;
  relevanceScore: number;
  influenceNote?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type ApprovalActionType =
  | "supplier_po_dispatch"
  | "checkout_dispute_override"
  | "inventory_adjustment"
  | "high_impact_price_change";

export interface ApprovalRequest {
  id: string;
  storeId: string;
  agentRunId?: string | null;
  actionType: ApprovalActionType;
  productId?: string | null;
  sku?: string | null;
  productName?: string | null;
  referenceId: string;
  proposedChange: string;
  financialImpact: number;
  agentExplanation: string;
  evidence: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "changes_requested";
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalDecision {
  id: string;
  approvalRequestId: string;
  decidedByUserId: string;
  decidedByName: string;
  decidedByRole: UserRole;
  decision: "approved" | "rejected" | "changes_requested";
  notes?: string | null;
  executionResult?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PricingRules {
  id: string;
  storeId: string;
  minMarginPct: number;
  autoApproveMaxDiscountPct: number;
  expiryAlertWindowDays: number;
  poAutoApproveLimit: number;
  inventoryAdjustApprovalThreshold: number;
  updatedAt: string;
}

export interface PriceRecommendation {
  id: string;
  storeId: string;
  productId: string;
  sku: string;
  productName: string;
  originalPrice: number;
  recommendedPrice: number;
  discountPct: number;
  expiryRisk: "low" | "medium" | "high" | "critical";
  expectedImpact: string;
  reason: string;
  requiresApproval: boolean;
  status: "pending" | "applied" | "pending_approval" | "rejected";
  createdAt: string;
}

export interface AuditLog {
  id: string;
  storeId: string;
  actorId: string;
  actorRole: string;
  eventCategory: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface StoreNotification {
  id: string;
  storeId: string;
  severity: "info" | "warning" | "critical" | "success";
  title: string;
  message: string;
  linkPath?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface DatabaseState {
  store: StoreConfig;
  profiles: Array<{
    id: string;
    email: string;
    passwordHash?: string;
    fullName: string;
    role: UserRole;
    storeId: string;
  }>;
  suppliers: Supplier[];
  products: ProductWithInventory[];
  inventoryMovements: InventoryMovement[];
  supplierProducts: SupplierProduct[];
  purchaseOrders: PurchaseOrder[];
  checkoutSessions: CheckoutSession[];
  checkoutDisputes: CheckoutDispute[];
  visionEvents: VisionEvent[];
  agentRuns: AgentRun[];
  agentToolExecutions: AgentToolExecution[];
  agentMemory: AgentMemoryRecord[];
  approvalRequests: ApprovalRequest[];
  approvalDecisions: ApprovalDecision[];
  pricingRules: PricingRules;
  priceRecommendations: PriceRecommendation[];
  auditLogs: AuditLog[];
  notifications: StoreNotification[];
}

