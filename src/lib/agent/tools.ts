import crypto from "node:crypto";
import { z } from "zod";
import {
  addAuditLog,
  addNotification,
  getFullState,
  mutateInventory,
  saveAgentMemoryRecord,
  saveApprovalRequestRecord,
  saveCheckoutAndDispute,
  savePriceRecommendationRecord,
  savePurchaseOrderRecord,
  saveVisionEvent,
} from "@/lib/db/repository";
import { DEMO_STORE_ID } from "@/lib/seed-data";
import { AgentToolExecution, MemoryCategory } from "@/types/retailens";

export interface ToolContext {
  agentRunId: string;
  actorName: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  schema: z.ZodTypeAny;
  parametersJsonSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<{
    status: AgentToolExecution["executionStatus"];
    result: Record<string, unknown>;
  }>;
}

function resolveProduct(
  products: Awaited<ReturnType<typeof getFullState>>["products"],
  skuOrId?: string
) {
  if (!skuOrId) return undefined;
  return products.find(
    (p) =>
      p.id === skuOrId ||
      p.sku.toLowerCase() === skuOrId.toLowerCase() ||
      p.barcode === skuOrId
  );
}

export const AGENT_TOOLS: Record<string, ToolSpec> = {
  analyze_checkout_and_shelf_feed: {
    name: "analyze_checkout_and_shelf_feed",
    description:
      "Analyze incoming camera/POS vision events to identify product detections, shelf stockouts, checkout barcode mismatches, and low-confidence anomalies.",
    riskLevel: "low",
    schema: z.object({
      cameraId: z.string().min(2).default("CAM-04"),
      sku: z.string().optional(),
      posBarcode: z.string().optional(),
      visualConfidencePct: z.number().min(0).max(100).optional(),
      shelfOccupancyPct: z.number().min(0).max(100).optional(),
      feedMode: z.enum(["demo", "connected", "upload"]).default("demo"),
    }),
    parametersJsonSchema: {
      type: "object",
      properties: {
        cameraId: { type: "string", description: "Camera ID e.g. CAM-04 or CAM-CHK-01" },
        sku: { type: "string", description: "Optional SKU to inspect" },
        posBarcode: { type: "string", description: "Optional POS scanned barcode to compare" },
        visualConfidencePct: { type: "number", description: "Detection confidence 0-100" },
        shelfOccupancyPct: { type: "number", description: "Shelf occupancy percentage 0-100" },
      },
      required: ["cameraId"],
    },
    async execute(raw) {
      const args = this.schema.parse(raw) as {
        cameraId: string;
        sku?: string;
        posBarcode?: string;
        visualConfidencePct?: number;
        shelfOccupancyPct?: number;
        feedMode: "demo" | "connected" | "upload";
      };
      const state = await getFullState();
      const targetProd =
        resolveProduct(state.products, args.sku) ??
        state.products.find((p) => p.sku === "SKU-OLV-088") ??
        state.products[0];

      const confidence = args.visualConfidencePct ?? 94.5;
      const occupancy =
        args.shelfOccupancyPct ??
        Math.min(100, Math.round((targetProd.availableQuantity / Math.max(1, targetProd.maxStockThreshold)) * 100));

      const barcodeMismatch =
        Boolean(args.posBarcode) && args.posBarcode !== targetProd.barcode;
      const lowConfidence = confidence < 80;
      const stockoutRisk =
        targetProd.availableQuantity <= targetProd.minStockThreshold || occupancy < 25;

      const eventType = barcodeMismatch || lowConfidence
        ? "anomaly_detected"
        : targetProd.availableQuantity <= 0
        ? "stockout_detected"
        : stockoutRisk
        ? "low_stock_detected"
        : args.cameraId.includes("CHK")
        ? "checkout_scan"
        : "shelf_scan";

      const event = await saveVisionEvent({
        cameraId: args.cameraId,
        feedMode: args.feedMode,
        eventType,
        productId: targetProd.id,
        sku: targetProd.sku,
        productName: targetProd.name,
        category: targetProd.category,
        aisle: targetProd.aisleLocation,
        confidencePct: confidence,
        shelfOccupancyPct: occupancy,
        boundingBoxes: [
          {
            label: targetProd.name,
            sku: targetProd.sku,
            confidence,
            x: 20,
            y: 25,
            width: 32,
            height: 48,
            status:
              barcodeMismatch || lowConfidence
                ? "anomaly"
                : targetProd.availableQuantity === 0
                ? "stockout"
                : stockoutRisk
                ? "low_stock"
                : "ok",
          },
        ],
        anomalyFlag: barcodeMismatch || lowConfidence || stockoutRisk,
        notes: `Analyzed via tool (${args.feedMode} mode): stock=${targetProd.availableQuantity}, confidence=${confidence}%`,
      });

      return {
        status: "executed",
        result: {
          visionEventId: event.id,
          cameraId: args.cameraId,
          sku: targetProd.sku,
          productName: targetProd.name,
          expectedBarcode: targetProd.barcode,
          posBarcode: args.posBarcode ?? targetProd.barcode,
          barcodeMismatch,
          lowConfidence,
          stockoutRisk,
          confidencePct: confidence,
          shelfOccupancyPct: occupancy,
          currentStock: targetProd.availableQuantity,
          minStockThreshold: targetProd.minStockThreshold,
        },
      };
    },
  },

  get_inventory_status: {
    name: "get_inventory_status",
    description:
      "Query real-time inventory quantity, stock thresholds, expiry date, and supplier metadata for a SKU or all low/out-of-stock products.",
    riskLevel: "low",
    schema: z.object({
      sku: z.string().optional(),
      filterStatus: z.enum(["all", "low_stock", "out_of_stock", "expiring_soon"]).default("all"),
    }),
    parametersJsonSchema: {
      type: "object",
      properties: {
        sku: { type: "string", description: "Specific SKU or product ID" },
        filterStatus: {
          type: "string",
          enum: ["all", "low_stock", "out_of_stock", "expiring_soon"],
        },
      },
    },
    async execute(raw) {
      const args = this.schema.parse(raw) as {
        sku?: string;
        filterStatus: "all" | "low_stock" | "out_of_stock" | "expiring_soon";
      };
      const state = await getFullState();
      if (args.sku) {
        const p = resolveProduct(state.products, args.sku);
        if (!p) {
          return { status: "failed", result: { error: `SKU '${args.sku}' not found.` } };
        }
        const daysToExpiry = Math.ceil(
          (new Date(p.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return {
          status: "executed",
          result: {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            barcode: p.barcode,
            availableQuantity: p.availableQuantity,
            minStockThreshold: p.minStockThreshold,
            maxStockThreshold: p.maxStockThreshold,
            stockStatus: p.stockStatus,
            sellingPrice: p.sellingPrice,
            costPrice: p.costPrice,
            expiryDate: p.expiryDate,
            daysToExpiry,
            primarySupplierId: p.primarySupplierId,
            supplierName: p.supplierName,
          },
        };
      }

      const items = state.products.filter((p) => {
        if (args.filterStatus === "low_stock") return p.stockStatus === "low_stock";
        if (args.filterStatus === "out_of_stock") return p.stockStatus === "out_of_stock";
        if (args.filterStatus === "expiring_soon") {
          const days = (new Date(p.expiryDate).getTime() - Date.now()) / (86400 * 1000);
          return days <= state.pricingRules.expiryAlertWindowDays;
        }
        return true;
      });

      return {
        status: "executed",
        result: {
          count: items.length,
          items: items.slice(0, 15).map((p) => ({
            sku: p.sku,
            name: p.name,
            availableQuantity: p.availableQuantity,
            minStockThreshold: p.minStockThreshold,
            stockStatus: p.stockStatus,
            expiryDate: p.expiryDate,
            sellingPrice: p.sellingPrice,
          })),
        },
      };
    },
  },

  get_product_history: {
    name: "get_product_history",
    description: "Retrieve historical stock movements and vision/checkout events for a SKU.",
    riskLevel: "low",
    schema: z.object({ sku: z.string().min(1) }),
    parametersJsonSchema: {
      type: "object",
      properties: { sku: { type: "string" } },
      required: ["sku"],
    },
    async execute(raw) {
      const { sku } = this.schema.parse(raw) as { sku: string };
      const state = await getFullState();
      const prod = resolveProduct(state.products, sku);
      if (!prod) return { status: "failed", result: { error: `SKU ${sku} not found.` } };

      const movements = state.inventoryMovements.filter((m) => m.productId === prod.id);
      const events = state.visionEvents.filter((v) => v.productId === prod.id);
      return {
        status: "executed",
        result: {
          sku: prod.sku,
          name: prod.name,
          movementCount: movements.length,
          recentMovements: movements.slice(0, 8),
          recentVisionEvents: events.slice(0, 5),
        },
      };
    },
  },

  retrieve_agent_memory: {
    name: "retrieve_agent_memory",
    description:
      "Retrieve persistent operational memories from PostgreSQL/store across inventory, supplier, checkout, pricing, and operational categories.",
    riskLevel: "low",
    schema: z.object({
      sku: z.string().optional(),
      category: z.enum(["inventory", "supplier", "checkout", "pricing", "operational"]).optional(),
      query: z.string().optional(),
    }),
    parametersJsonSchema: {
      type: "object",
      properties: {
        sku: { type: "string" },
        category: { type: "string", enum: ["inventory", "supplier", "checkout", "pricing", "operational"] },
        query: { type: "string" },
      },
    },
    async execute(raw) {
      const args = this.schema.parse(raw) as {
        sku?: string;
        category?: MemoryCategory;
        query?: string;
      };
      const state = await getFullState();
      const q = args.query?.toLowerCase();
      const matches = state.agentMemory
        .filter((m) => {
          if (args.sku && m.sku && m.sku.toLowerCase() !== args.sku.toLowerCase()) return false;
          if (args.category && m.category !== args.category) return false;
          if (q) {
            return (
              m.title.toLowerCase().includes(q) ||
              m.content.toLowerCase().includes(q) ||
              (m.sku?.toLowerCase().includes(q) ?? false)
            );
          }
          return true;
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 6);

      return {
        status: "executed",
        result: {
          retrievedCount: matches.length,
          memories: matches.map((m) => ({
            id: m.id,
            category: m.category,
            sku: m.sku,
            title: m.title,
            content: m.content,
            relevanceScore: m.relevanceScore,
            influenceNote: m.influenceNote,
            createdAt: m.createdAt,
          })),
        },
      };
    },
  },

  save_agent_memory: {
    name: "save_agent_memory",
    description:
      "Persist an observed operational insight, velocity pattern, or resolution outcome into cross-session agent memory.",
    riskLevel: "low",
    schema: z.object({
      category: z.enum(["inventory", "supplier", "checkout", "pricing", "operational"]),
      sku: z.string().optional(),
      title: z.string().min(3),
      content: z.string().min(5),
      relevanceScore: z.number().min(0).max(1).default(0.88),
      influenceNote: z.string().optional(),
    }),
    parametersJsonSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["inventory", "supplier", "checkout", "pricing", "operational"] },
        sku: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        relevanceScore: { type: "number" },
        influenceNote: { type: "string" },
      },
      required: ["category", "title", "content"],
    },
    async execute(raw) {
      const args = this.schema.parse(raw) as {
        category: MemoryCategory;
        sku?: string;
        title: string;
        content: string;
        relevanceScore: number;
        influenceNote?: string;
      };
      const saved = await saveAgentMemoryRecord(args);
      return {
        status: "executed",
        result: { memoryId: saved.id, title: saved.title, category: saved.category, sku: saved.sku },
      };
    },
  },

  detect_stock_depletion_velocity: {
    name: "detect_stock_depletion_velocity",
    description:
      "Calculate estimated daily depletion velocity, days-of-cover remaining, and recommended safety stock reorder quantity for a SKU.",
    riskLevel: "low",
    schema: z.object({ sku: z.string().min(1) }),
    parametersJsonSchema: {
      type: "object",
      properties: { sku: { type: "string" } },
      required: ["sku"],
    },
    async execute(raw) {
      const { sku } = this.schema.parse(raw) as { sku: string };
      const state = await getFullState();
      const prod = resolveProduct(state.products, sku);
      if (!prod) return { status: "failed", result: { error: `SKU ${sku} not found.` } };

      const salesMoves = state.inventoryMovements.filter(
        (m) => m.productId === prod.id && m.movementType === "sale_deduction"
      );
      const totalSold = salesMoves.reduce((acc, m) => acc + Math.abs(m.quantityDelta), 0);
      const memoryBoost = state.agentMemory.some(
        (m) => m.sku === prod.sku && m.content.toLowerCase().includes("2.4x")
      )
        ? 6.2
        : 0;
      const dailyVelocity = Number(
        Math.max(2.5, memoryBoost || (totalSold > 0 ? totalSold * 1.4 : 3.8)).toFixed(1)
      );
      const daysOfCover = Number((prod.availableQuantity / dailyVelocity).toFixed(1));
      const supplier = state.suppliers.find((s) => s.id === prod.primarySupplierId);
      const leadTime = supplier?.avgLeadTimeDays ?? 3;
      const suggestedReorderQty = Math.max(
        supplier?.minOrderQuantity ?? 12,
        Math.min(
          prod.maxStockThreshold - prod.availableQuantity,
          Math.ceil(dailyVelocity * (leadTime + 2))
        )
      );

      return {
        status: "executed",
        result: {
          sku: prod.sku,
          productName: prod.name,
          availableQuantity: prod.availableQuantity,
          dailyVelocity,
          daysOfCover,
          supplierLeadTimeDays: leadTime,
          stockoutBeforeDeliveryRisk: daysOfCover <= leadTime,
          suggestedReorderQty,
        },
      };
    },
  },

  get_supplier_lead_times: {
    name: "get_supplier_lead_times",
    description: "Retrieve supplier reliability, fulfillment rate, MOQ, and lead time for a SKU or supplier.",
    riskLevel: "low",
    schema: z.object({ sku: z.string().optional(), supplierId: z.string().optional() }),
    parametersJsonSchema: {
      type: "object",
      properties: {
        sku: { type: "string" },
        supplierId: { type: "string" },
      },
    },
    async execute(raw) {
      const args = this.schema.parse(raw) as { sku?: string; supplierId?: string };
      const state = await getFullState();
      let sup = args.supplierId
        ? state.suppliers.find((s) => s.id === args.supplierId)
        : undefined;
      if (!sup && args.sku) {
        const prod = resolveProduct(state.products, args.sku);
        if (prod) sup = state.suppliers.find((s) => s.id === prod.primarySupplierId);
      }

      if (!sup) {
        return {
          status: "executed",
          result: { suppliers: state.suppliers },
        };
      }
      return {
        status: "executed",
        result: {
          supplierId: sup.id,
          name: sup.name,
          avgLeadTimeDays: sup.avgLeadTimeDays,
          minOrderQuantity: sup.minOrderQuantity,
          fulfillmentRatePct: sup.fulfillmentRatePct,
          status: sup.status,
        },
      };
    },
  },

  mutate_pos_inventory_db: {
    name: "mutate_pos_inventory_db",
    description:
      "Execute an idempotent, transactional inventory deduction or adjustment. Blocked automatically if visual confidence is below 80% or delta exceeds approval threshold.",
    riskLevel: "medium",
    schema: z.object({
      sku: z.string().min(1),
      quantityDelta: z.number().int().refine((n) => n !== 0, "Delta cannot be zero"),
      movementType: z
        .enum(["sale_deduction", "restock", "adjustment", "expiry_writeoff", "return"])
        .default("sale_deduction"),
      reason: z.string().min(3),
      visualConfidencePct: z.number().min(0).max(100).default(95),
      idempotencyKey: z.string().optional(),
      referenceId: z.string().optional(),
    }),
    parametersJsonSchema: {
      type: "object",
      properties: {
        sku: { type: "string" },
        quantityDelta: { type: "number" },
        movementType: { type: "string" },
        reason: { type: "string" },
        visualConfidencePct: { type: "number" },
        idempotencyKey: { type: "string" },
      },
      required: ["sku", "quantityDelta", "reason"],
    },
    async execute(raw, ctx) {
      const args = this.schema.parse(raw) as {
        sku: string;
        quantityDelta: number;
        movementType: "sale_deduction" | "restock" | "adjustment" | "expiry_writeoff" | "return";
        reason: string;
        visualConfidencePct: number;
        idempotencyKey?: string;
        referenceId?: string;
      };
      const state = await getFullState();
      const prod = resolveProduct(state.products, args.sku);
      if (!prod) return { status: "failed", result: { error: `SKU ${args.sku} not found.` } };

      // Safety Gate 1: Never mutate inventory on low-confidence vision detections (<80%)
      if (args.visualConfidencePct < 80) {
        return {
          status: "blocked",
          result: {
            blocked: true,
            reason: `Visual confidence ${args.visualConfidencePct}% is below the 80% safety threshold. Inventory mutation paused; route to checkout dispute review.`,
            sku: prod.sku,
          },
        };
      }

      // Safety Gate 2: Large manual adjustments require manager approval
      if (
        args.movementType === "adjustment" &&
        Math.abs(args.quantityDelta) > state.pricingRules.inventoryAdjustApprovalThreshold
      ) {
        const req = await saveApprovalRequestRecord({
          id: crypto.randomUUID(),
          storeId: DEMO_STORE_ID,
          agentRunId: ctx.agentRunId,
          actionType: "inventory_adjustment",
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          referenceId: args.referenceId || prod.id,
          proposedChange: `Adjust ${prod.name} (${prod.sku}) inventory by ${args.quantityDelta} units.`,
          financialImpact: Math.abs(args.quantityDelta) * prod.costPrice,
          agentExplanation: `Adjustment magnitude (${Math.abs(args.quantityDelta)}) exceeds store threshold (${state.pricingRules.inventoryAdjustApprovalThreshold}).`,
          evidence: { currentStock: prod.availableQuantity, requestedDelta: args.quantityDelta },
          riskLevel: "high",
          status: "pending",
          payload: { productId: prod.id, quantityDelta: args.quantityDelta },
          idempotencyKey: args.idempotencyKey,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return {
          status: "awaiting_approval",
          result: {
            approvalRequestId: req.id,
            message: "Large inventory adjustment queued for Store Manager approval.",
          },
        };
      }

      const mutation = await mutateInventory({
        productId: prod.id,
        quantityDelta: args.quantityDelta,
        movementType: args.movementType,
        reason: args.reason,
        referenceType: "agent_run",
        referenceId: args.referenceId || ctx.agentRunId,
        idempotencyKey: args.idempotencyKey || `agent-${ctx.agentRunId}-${prod.sku}-${args.quantityDelta}`,
        performedBy: ctx.actorName,
      });

      await addAuditLog({
        actorId: ctx.agentRunId,
        actorRole: "ai_agent",
        eventCategory: "inventory",
        action: "inventory_mutated",
        entityType: "product",
        entityId: prod.id,
        summary: `Inventory updated for ${prod.sku}: ${mutation.quantityBefore} -> ${mutation.quantityAfter} (${args.reason}).`,
        details: mutation,
      });

      return {
        status: "executed",
        result: mutation,
      };
    },
  },

  calculate_dynamic_expiry_discount: {
    name: "calculate_dynamic_expiry_discount",
    description:
      "Evaluate expiry risk for a SKU or expiring catalog items, enforce minimum-margin pricing rules, and generate dynamic markdown recommendations.",
    riskLevel: "medium",
    schema: z.object({
      sku: z.string().optional(),
      applyIfWithinAutonomousLimit: z.boolean().default(false),
    }),
    parametersJsonSchema: {
      type: "object",
      properties: {
        sku: { type: "string" },
        applyIfWithinAutonomousLimit: { type: "boolean" },
      },
    },
    async execute(raw, ctx) {
      const args = this.schema.parse(raw) as {
        sku?: string;
        applyIfWithinAutonomousLimit: boolean;
      };
      const state = await getFullState();
      const rules = state.pricingRules;
      const targets = args.sku
        ? [resolveProduct(state.products, args.sku)].filter((p): p is NonNullable<typeof p> => Boolean(p))
        : state.products.filter((p) => {
            const days = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000);
            return days <= rules.expiryAlertWindowDays && p.availableQuantity > 0;
          });

      if (targets.length === 0) {
        return { status: "executed", result: { recommendations: [], message: "No products within expiry risk window." } };
      }

      const recommendations = [];
      for (const prod of targets.slice(0, 6)) {
        const daysRemaining = Math.max(
          0,
          Math.ceil((new Date(prod.expiryDate).getTime() - Date.now()) / 86400000)
        );
        const rawDiscountPct =
          daysRemaining <= 1 ? 28 : daysRemaining <= 3 ? 22 : daysRemaining <= 6 ? 15 : 10;

        // Enforce minimum margin floor!
        const minAllowedPrice = Number(
          (prod.costPrice * (1 + rules.minMarginPct / 100)).toFixed(2)
        );
        const candidatePrice = Number((prod.sellingPrice * (1 - rawDiscountPct / 100)).toFixed(2));
        const recommendedPrice = Math.max(minAllowedPrice, candidatePrice);
        const effectiveDiscountPct = Number(
          (((prod.sellingPrice - recommendedPrice) / prod.sellingPrice) * 100).toFixed(1)
        );
        const expiryRisk =
          daysRemaining <= 2 ? "critical" : daysRemaining <= 5 ? "high" : "medium";
        const requiresApproval = effectiveDiscountPct > rules.autoApproveMaxDiscountPct;

        const recId = crypto.randomUUID();
        const rec = await savePriceRecommendationRecord({
          id: recId,
          storeId: DEMO_STORE_ID,
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          originalPrice: prod.sellingPrice,
          recommendedPrice,
          discountPct: effectiveDiscountPct,
          expiryRisk,
          expectedImpact: `Clears ~85% of ${prod.availableQuantity} units within ${daysRemaining}d while preserving >=${rules.minMarginPct}% margin`,
          reason: `${daysRemaining}d remaining shelf life; capped by ${rules.minMarginPct}% minimum margin floor (min price ₹${minAllowedPrice}).`,
          requiresApproval,
          status: requiresApproval ? "pending_approval" : "pending",
          createdAt: new Date().toISOString(),
        });

        if (requiresApproval) {
          await saveApprovalRequestRecord({
            id: crypto.randomUUID(),
            storeId: DEMO_STORE_ID,
            agentRunId: ctx.agentRunId,
            actionType: "high_impact_price_change",
            productId: prod.id,
            sku: prod.sku,
            productName: prod.name,
            referenceId: recId,
            proposedChange: `Apply ${effectiveDiscountPct}% expiry discount on ${prod.name} (₹${prod.sellingPrice} → ₹${recommendedPrice}).`,
            financialImpact: Number(
              ((prod.sellingPrice - recommendedPrice) * prod.availableQuantity).toFixed(2)
            ),
            agentExplanation: rec.reason,
            evidence: {
              daysRemaining,
              currentStock: prod.availableQuantity,
              costPrice: prod.costPrice,
              minAllowedPrice,
              effectiveDiscountPct,
            },
            riskLevel: "medium",
            status: "pending",
            payload: { recommendationId: recId, productId: prod.id, newPrice: recommendedPrice },
            idempotencyKey: `price-${prod.sku}-${daysRemaining}d-${recId.slice(0, 8)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        recommendations.push({
          id: rec.id,
          sku: prod.sku,
          productName: prod.name,
          originalPrice: prod.sellingPrice,
          recommendedPrice,
          discountPercentage: effectiveDiscountPct,
          reason: rec.reason,
          expiryRisk,
          approvalRequired: requiresApproval,
        });
      }

      return {
        status: recommendations.some((r) => r.approvalRequired) ? "awaiting_approval" : "executed",
        result: { recommendations },
      };
    },
  },

  dispatch_supplier_purchase_order: {
    name: "dispatch_supplier_purchase_order",
    description:
      "Prepare a replenishment Purchase Order draft with lead time and value calculation. Drafting is autonomous; dispatching always requires explicit Store Manager approval above threshold.",
    riskLevel: "high",
    schema: z.object({
      sku: z.string().min(1),
      quantity: z.number().int().positive().optional(),
      reason: z.string().default("Low-stock replenishment triggered by autonomous operations agent."),
      idempotencyKey: z.string().optional(),
    }),
    parametersJsonSchema: {
      type: "object",
      properties: {
        sku: { type: "string" },
        quantity: { type: "number" },
        reason: { type: "string" },
      },
      required: ["sku"],
    },
    async execute(raw, ctx) {
      const args = this.schema.parse(raw) as {
        sku: string;
        quantity?: number;
        reason: string;
        idempotencyKey?: string;
      };
      const state = await getFullState();
      const prod = resolveProduct(state.products, args.sku);
      if (!prod) return { status: "failed", result: { error: `SKU ${args.sku} not found.` } };

      const supplier = state.suppliers.find((s) => s.id === prod.primarySupplierId) ?? state.suppliers[0];
      const reorderQty = Math.max(
        supplier.minOrderQuantity,
        args.quantity ?? Math.max(24, prod.maxStockThreshold - prod.availableQuantity)
      );
      const totalValue = Number((reorderQty * prod.costPrice).toFixed(2));
      const poId = crypto.randomUUID();
      const poNumber = `PO-2026-${Math.floor(1100 + Math.random() * 8800)}`;

      // High-value POs or any dispatch require manager approval!
      const requiresApproval = totalValue > state.pricingRules.poAutoApproveLimit || true;

      const po = await savePurchaseOrderRecord({
        id: poId,
        poNumber,
        storeId: DEMO_STORE_ID,
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: requiresApproval ? "pending_approval" : "draft",
        totalValue,
        estimatedLeadTimeDays: supplier.avgLeadTimeDays,
        reason: args.reason,
        createdBy: ctx.actorName,
        approvedBy: null,
        idempotencyKey: args.idempotencyKey,
        items: [
          {
            id: crypto.randomUUID(),
            purchaseOrderId: poId,
            productId: prod.id,
            sku: prod.sku,
            productName: prod.name,
            orderedQuantity: reorderQty,
            unitCost: prod.costPrice,
            lineTotal: totalValue,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const approvalReq = await saveApprovalRequestRecord({
        id: crypto.randomUUID(),
        storeId: DEMO_STORE_ID,
        agentRunId: ctx.agentRunId,
        actionType: "supplier_po_dispatch",
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        referenceId: po.id,
        proposedChange: `Dispatch ${po.poNumber} for ${reorderQty} units of ${prod.name} (${prod.sku}) to ${supplier.name}.`,
        financialImpact: totalValue,
        agentExplanation: `${args.reason} Estimated lead time: ${supplier.avgLeadTimeDays}d; Supplier fulfillment: ${supplier.fulfillmentRatePct}%.`,
        evidence: {
          poNumber: po.poNumber,
          currentStock: prod.availableQuantity,
          minThreshold: prod.minStockThreshold,
          reorderQty,
          unitCost: prod.costPrice,
          totalValue,
          leadTimeDays: supplier.avgLeadTimeDays,
        },
        riskLevel: totalValue > 15000 ? "high" : "medium",
        status: "pending",
        payload: { purchaseOrderId: po.id, supplierId: supplier.id, quantity: reorderQty },
        idempotencyKey: `po-appr-${po.id}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await addAuditLog({
        actorId: ctx.agentRunId,
        actorRole: "ai_agent",
        eventCategory: "purchase_order",
        action: "po_draft_created",
        entityType: "purchase_order",
        entityId: po.id,
        summary: `Agent drafted ${po.poNumber} (₹${totalValue.toLocaleString("en-IN")}) for ${prod.sku} and queued for manager approval.`,
        details: { poNumber: po.poNumber, approvalRequestId: approvalReq.id },
      });

      await addNotification({
        severity: "warning",
        title: `Approval Required: ${po.poNumber}`,
        message: `${reorderQty} units of ${prod.name} (₹${totalValue.toLocaleString("en-IN")}) awaiting manager authorization.`,
        linkPath: "/dashboard/approvals",
      });

      return {
        status: "awaiting_approval",
        result: {
          purchaseOrderId: po.id,
          poNumber: po.poNumber,
          supplierName: supplier.name,
          orderedQuantity: reorderQty,
          estimatedValue: totalValue,
          estimatedLeadTimeDays: supplier.avgLeadTimeDays,
          approvalRequestId: approvalReq.id,
          status: "pending_approval",
          message: "PO draft created autonomously; halted dispatch until authorized manager approves.",
        },
      };
    },
  },

  create_checkout_dispute: {
    name: "create_checkout_dispute",
    description:
      "Pause automated checkout inventory deduction when vision and POS disagree or confidence is low, and escalate a review request to the Approval Center.",
    riskLevel: "medium",
    schema: z.object({
      cameraId: z.string().default("CAM-CHK-02"),
      cashierId: z.string().default("CSH-109 (Meera Nair)"),
      scannedSku: z.string(),
      visualSku: z.string(),
      visualConfidencePct: z.number().min(0).max(100),
      disputeType: z
        .enum(["barcode_mismatch", "price_discrepancy", "duplicate_scan", "missing_scan", "low_confidence"])
        .default("barcode_mismatch"),
      description: z.string(),
    }),
    parametersJsonSchema: {
      type: "object",
      properties: {
        cameraId: { type: "string" },
        scannedSku: { type: "string" },
        visualSku: { type: "string" },
        visualConfidencePct: { type: "number" },
        disputeType: { type: "string" },
        description: { type: "string" },
      },
      required: ["scannedSku", "visualSku", "visualConfidencePct", "description"],
    },
    async execute(raw, ctx) {
      const args = this.schema.parse(raw) as {
        cameraId: string;
        cashierId: string;
        scannedSku: string;
        visualSku: string;
        visualConfidencePct: number;
        disputeType:
          | "barcode_mismatch"
          | "price_discrepancy"
          | "duplicate_scan"
          | "missing_scan"
          | "low_confidence";
        description: string;
      };
      const state = await getFullState();
      const scannedProd = resolveProduct(state.products, args.scannedSku) ?? state.products[1];
      const visualProd = resolveProduct(state.products, args.visualSku) ?? state.products[5];

      const sessionId = crypto.randomUUID();
      const sessionCode = `CHK-01-${Math.floor(2000 + Math.random() * 7999)}`;
      const disputeId = crypto.randomUUID();
      const now = new Date().toISOString();

      const subtotal = scannedProd.sellingPrice;
      const gstAmount = Number(((subtotal * state.store.gstRatePct) / 100).toFixed(2));

      await saveCheckoutAndDispute(
        {
          id: sessionId,
          sessionCode,
          storeId: DEMO_STORE_ID,
          cashierId: args.cashierId,
          cameraId: args.cameraId,
          status: "paused_review",
          visualConfidence: args.visualConfidencePct,
          subtotal,
          gstAmount,
          totalAmount: Number((subtotal + gstAmount).toFixed(2)),
          anomalyReason: args.description,
          items: [
            {
              id: crypto.randomUUID(),
              checkoutSessionId: sessionId,
              productId: scannedProd.id,
              sku: scannedProd.sku,
              productName: scannedProd.name,
              scannedBarcode: scannedProd.barcode,
              expectedPrice: visualProd.sellingPrice,
              posPrice: scannedProd.sellingPrice,
              quantity: 1,
              visualConfidence: args.visualConfidencePct,
              matchStatus: args.disputeType,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: disputeId,
          storeId: DEMO_STORE_ID,
          checkoutSessionId: sessionId,
          sessionCode,
          disputeType: args.disputeType,
          description: args.description,
          evidence: {
            cameraId: args.cameraId,
            scannedSku: scannedProd.sku,
            visualSku: visualProd.sku,
            visualConfidencePct: args.visualConfidencePct,
            posPrice: scannedProd.sellingPrice,
            expectedPrice: visualProd.sellingPrice,
          },
          status: "pending_approval",
          resolutionNotes: null,
          resolvedBy: null,
          createdAt: now,
          updatedAt: now,
        }
      );

      const approvalReq = await saveApprovalRequestRecord({
        id: crypto.randomUUID(),
        storeId: DEMO_STORE_ID,
        agentRunId: ctx.agentRunId,
        actionType: "checkout_dispute_override",
        productId: visualProd.id,
        sku: visualProd.sku,
        productName: visualProd.name,
        referenceId: disputeId,
        proposedChange: `Review ${sessionCode}: POS scanned ${scannedProd.name} (₹${scannedProd.sellingPrice}) vs Vision ${visualProd.name} (₹${visualProd.sellingPrice}) at ${args.visualConfidencePct}% confidence.`,
        financialImpact: Math.abs(visualProd.sellingPrice - scannedProd.sellingPrice),
        agentExplanation: `${args.description} Inventory mutation paused automatically to prevent unauthorized override.`,
        evidence: {
          sessionCode,
          cameraId: args.cameraId,
          confidencePct: args.visualConfidencePct,
          scannedSku: scannedProd.sku,
          visualSku: visualProd.sku,
        },
        riskLevel: "medium",
        status: "pending",
        payload: {
          disputeId,
          checkoutSessionId: sessionId,
          productId: visualProd.id,
          sku: visualProd.sku,
        },
        idempotencyKey: `dispute-appr-${disputeId}`,
        createdAt: now,
        updatedAt: now,
      });

      await addAuditLog({
        actorId: ctx.agentRunId,
        actorRole: "ai_agent",
        eventCategory: "checkout",
        action: "checkout_dispute_created",
        entityType: "checkout_dispute",
        entityId: disputeId,
        summary: `Paused checkout ${sessionCode} (${args.disputeType}, ${args.visualConfidencePct}% confidence) and created approval review.`,
        details: { approvalRequestId: approvalReq.id },
      });

      return {
        status: "awaiting_approval",
        result: {
          sessionCode,
          disputeId,
          approvalRequestId: approvalReq.id,
          inventoryMutated: false,
          message: "Checkout paused and escalated to Approval Center.",
        },
      };
    },
  },

  resolve_checkout_dispute: {
    name: "resolve_checkout_dispute",
    description:
      "Check status or prepare resolution payload for a checkout dispute. Note: Final override execution requires manager authorization via Approval Center.",
    riskLevel: "medium",
    schema: z.object({ disputeId: z.string().min(1) }),
    parametersJsonSchema: {
      type: "object",
      properties: { disputeId: { type: "string" } },
      required: ["disputeId"],
    },
    async execute(raw) {
      const { disputeId } = this.schema.parse(raw) as { disputeId: string };
      const state = await getFullState();
      const dispute = state.checkoutDisputes.find(
        (d) => d.id === disputeId || d.sessionCode === disputeId
      );
      if (!dispute) return { status: "failed", result: { error: "Checkout dispute not found." } };
      return {
        status: dispute.status === "pending_approval" ? "awaiting_approval" : "executed",
        result: {
          disputeId: dispute.id,
          sessionCode: dispute.sessionCode,
          status: dispute.status,
          policyNote: "Overriding a disputed checkout requires human manager approval.",
        },
      };
    },
  },

  generate_store_operational_report: {
    name: "generate_store_operational_report",
    description:
      "Compute a real-time store operational snapshot across stock health, expiry risk, checkout accuracy, and pending manager approvals.",
    riskLevel: "low",
    schema: z.object({ includeRecommendations: z.boolean().default(true) }),
    parametersJsonSchema: {
      type: "object",
      properties: { includeRecommendations: { type: "boolean" } },
    },
    async execute(raw) {
      const args = this.schema.parse(raw) as { includeRecommendations: boolean };
      const state = await getFullState();
      const lowStock = state.products.filter((p) => p.stockStatus === "low_stock");
      const outOfStock = state.products.filter((p) => p.stockStatus === "out_of_stock");
      const expiring = state.products.filter((p) => {
        const d = (new Date(p.expiryDate).getTime() - Date.now()) / 86400000;
        return d <= state.pricingRules.expiryAlertWindowDays;
      });
      const pendingApprovals = state.approvalRequests.filter((a) => a.status === "pending");
      const totalRevenue = state.checkoutSessions
        .filter((c) => c.status === "completed")
        .reduce((acc, c) => acc + c.totalAmount, 0);

      return {
        status: "executed",
        result: {
          storeName: state.store.name,
          totalSkus: state.products.length,
          totalInventoryUnits: state.products.reduce((a, p) => a + p.availableQuantity, 0),
          lowStockCount: lowStock.length,
          outOfStockCount: outOfStock.length,
          expiringSoonCount: expiring.length,
          pendingApprovalsCount: pendingApprovals.length,
          completedCheckoutRevenue: Number(totalRevenue.toFixed(2)),
          flaggedLowStockSkus: lowStock.map((p) => `${p.sku} (${p.availableQuantity})`),
          flaggedOutOfStockSkus: outOfStock.map((p) => p.sku),
          includeRecommendations: args.includeRecommendations,
        },
      };
    },
  },
};

