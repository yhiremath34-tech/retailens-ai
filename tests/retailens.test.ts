import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { canApproveSensitiveActions, hasPermission } from "@/lib/auth/rbac";
import {
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth/session";
import {
  applyAtomicInventoryDeltaInMemory,
  readLocalDb,
  resetLocalDbToSeed,
} from "@/lib/db/local-db";
import { decideApprovalRequest } from "@/lib/db/repository";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import { runAutonomousAgent } from "@/lib/agent/orchestrator";
import { DEMO_STORE_ID, buildSeedDatabaseState } from "@/lib/seed-data";
import { UserSession } from "@/types/retailens";

const managerActor: UserSession = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "manager@retailens.demo",
  fullName: "Ananya Rao",
  role: "store_manager",
  storeId: DEMO_STORE_ID,
  authMode: "simulation",
};

const cashierActor: UserSession = {
  id: "00000000-0000-4000-8000-000000000004",
  email: "cashier@retailens.demo",
  fullName: "Meera Patel",
  role: "cashier",
  storeId: DEMO_STORE_ID,
  authMode: "simulation",
};

const inventoryActor: UserSession = {
  id: "00000000-0000-4000-8000-000000000003",
  email: "inventory@retailens.demo",
  fullName: "Karthik Nair",
  role: "inventory_manager",
  storeId: DEMO_STORE_ID,
  authMode: "simulation",
};

describe("RetaiLens AI Core Guarantees", () => {
  beforeEach(async () => {
    await resetLocalDbToSeed();
  });

  afterAll(async () => {
    await resetLocalDbToSeed();
  });

  describe("1. Role-Based Access Control (RBAC)", () => {
    it("allows owners and managers to approve sensitive actions and dispatch POs", () => {
      expect(canApproveSensitiveActions("store_owner")).toBe(true);
      expect(canApproveSensitiveActions("store_manager")).toBe(true);
      expect(hasPermission("store_manager", "dispatch_po")).toBe(true);
      expect(hasPermission("store_owner", "manage_settings")).toBe(true);
    });

    it("blocks cashiers and inventory managers from sensitive approvals and PO dispatch", () => {
      expect(canApproveSensitiveActions("cashier")).toBe(false);
      expect(canApproveSensitiveActions("inventory_manager")).toBe(false);
      expect(hasPermission("cashier", "manage_inventory")).toBe(false);
      expect(hasPermission("cashier", "create_po")).toBe(false);
      expect(hasPermission("inventory_manager", "dispatch_po")).toBe(false);
      expect(hasPermission("inventory_manager", "create_po")).toBe(true);
    });
  });

  describe("2. Password Hashing & Signed Session Integrity", () => {
    it("hashes and verifies scrypt passwords cleanly", () => {
      const hash = hashPassword("Retailens#Demo123");
      expect(hash).toContain(":");
      expect(verifyPassword("Retailens#Demo123", hash)).toBe(true);
      expect(verifyPassword("WrongPassword!", hash)).toBe(false);
    });

    it("signs and verifies HMAC session tokens and rejects tampered payloads", () => {
      const token = signSessionToken(managerActor);
      const verified = verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.email).toBe(managerActor.email);
      expect(verified?.role).toBe("store_manager");

      const [payloadPart, sigPart] = token.split(".");
      const decoded = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
      decoded.role = "store_owner";
      const forgedPayload = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");
      expect(verifySessionToken(`${forgedPayload}.${sigPart}`)).toBeNull();
    });
  });

  describe("3. Transactional & Idempotent Inventory Mutations", () => {
    it("deducts stock atomically and prevents duplicate deductions with the same idempotency key", () => {
      const state = buildSeedDatabaseState();
      const oliveOil = state.products.find((p) => p.sku === "SKU-OLV-088")!;
      const initialQty = oliveOil.availableQuantity;

      const first = applyAtomicInventoryDeltaInMemory(state, {
        productId: oliveOil.id,
        quantityDelta: -2,
        movementType: "sale_deduction",
        reason: "Unit test checkout",
        idempotencyKey: "idem-test-001",
        performedBy: "Test Runner",
      });
      expect(first.idempotentReplay).toBe(false);
      expect(first.quantityBefore).toBe(initialQty);
      expect(first.quantityAfter).toBe(initialQty - 2);

      const replay = applyAtomicInventoryDeltaInMemory(state, {
        productId: oliveOil.id,
        quantityDelta: -2,
        movementType: "sale_deduction",
        reason: "Unit test checkout",
        idempotencyKey: "idem-test-001",
        performedBy: "Test Runner",
      });
      expect(replay.idempotentReplay).toBe(true);
      expect(replay.quantityAfter).toBe(initialQty - 2);
      expect(oliveOil.availableQuantity).toBe(initialQty - 2);
    });

    it("throws on insufficient stock instead of allowing negative inventory", () => {
      const state = buildSeedDatabaseState();
      const oliveOil = state.products.find((p) => p.sku === "SKU-OLV-088")!;
      expect(() =>
        applyAtomicInventoryDeltaInMemory(state, {
          productId: oliveOil.id,
          quantityDelta: -(oliveOil.availableQuantity + 5),
          movementType: "sale_deduction",
          reason: "Oversell attempt",
          performedBy: "Test Runner",
        })
      ).toThrow(/Insufficient stock/);
    });
  });

  describe("4. Agent Tool Validation & Safety Boundaries", () => {
    it("blocks inventory deduction when CV visual confidence is below 80%", async () => {
      const stateBefore = await readLocalDb();
      const milkBefore = stateBefore.products.find((p) => p.sku === "SKU-MLK-002")!.availableQuantity;

      const res = await AGENT_TOOLS.mutate_pos_inventory_db.execute(
        {
          sku: "SKU-MLK-002",
          quantityDelta: -1,
          movementType: "sale_deduction",
          reason: "Low confidence barcode ambiguity",
          visualConfidencePct: 68,
        },
        { agentRunId: "test-run-lowconf", actorName: "Test Agent" }
      );

      expect(res.status).toBe("blocked");
      expect(res.result.blocked).toBe(true);

      const stateAfter = await readLocalDb();
      const milkAfter = stateAfter.products.find((p) => p.sku === "SKU-MLK-002")!.availableQuantity;
      expect(milkAfter).toBe(milkBefore);
    });

    it("enforces minimum margin floor on dynamic expiry discounts", async () => {
      const state = await readLocalDb();
      const milk = state.products.find((p) => p.sku === "SKU-MLK-002")!;
      const minAllowedPrice = Number(
        (milk.costPrice * (1 + state.pricingRules.minMarginPct / 100)).toFixed(2)
      );

      const res = await AGENT_TOOLS.calculate_dynamic_expiry_discount.execute(
        { sku: "SKU-MLK-002", applyIfWithinAutonomousLimit: false },
        { agentRunId: "test-run-pricing", actorName: "Test Agent" }
      );

      const recs = res.result.recommendations as Array<{
        sku: string;
        recommendedPrice: number;
        discountPercentage: number;
        approvalRequired: boolean;
      }>;
      expect(recs).toHaveLength(1);
      expect(recs[0].sku).toBe("SKU-MLK-002");
      expect(recs[0].recommendedPrice).toBeGreaterThanOrEqual(minAllowedPrice);
    });

    it("queues supplier PO drafts for manager approval and enforces server-side RBAC on decisions", async () => {
      const poRes = await AGENT_TOOLS.dispatch_supplier_purchase_order.execute(
        {
          sku: "SKU-OLV-088",
          quantity: 30,
          reason: "Olive oil safety stock below threshold",
        },
        { agentRunId: "test-run-po", actorName: "Test Agent" }
      );

      expect(poRes.status).toBe("awaiting_approval");
      const approvalId = String(poRes.result.approvalRequestId);
      const poId = String(poRes.result.purchaseOrderId);
      expect(approvalId).toBeTruthy();

      await expect(
        decideApprovalRequest({
          requestId: approvalId,
          decision: "approved",
          notes: "Unauthorized attempt",
          actor: cashierActor,
        })
      ).rejects.toThrow(/Authorization error/);

      await expect(
        decideApprovalRequest({
          requestId: approvalId,
          decision: "approved",
          notes: "Inventory manager cannot approve PO dispatch",
          actor: inventoryActor,
        })
      ).rejects.toThrow(/Authorization error/);

      const decision = await decideApprovalRequest({
        requestId: approvalId,
        decision: "approved",
        notes: "Verified reorder quantity and lead time",
        actor: managerActor,
      });

      expect(decision.executionResult.executedAction).toBe("purchase_order_dispatched");
      const updated = await readLocalDb();
      const po = updated.purchaseOrders.find((p) => p.id === poId);
      expect(po?.status).toBe("dispatched");
      expect(po?.approvedBy).toBe(managerActor.fullName);
    });

    it("preserves database state when manager rejects a pending approval request", async () => {
      const poRes = await AGENT_TOOLS.dispatch_supplier_purchase_order.execute(
        {
          sku: "SKU-COF-001",
          quantity: 25,
          reason: "Test rejection workflow",
        },
        { agentRunId: "test-run-reject", actorName: "Test Agent" }
      );
      const approvalId = String(poRes.result.approvalRequestId);
      const poId = String(poRes.result.purchaseOrderId);

      const rejected = await decideApprovalRequest({
        requestId: approvalId,
        decision: "rejected",
        notes: "Hold order until weekend audit",
        actor: managerActor,
      });

      expect(rejected.executionResult.executedAction).toBe("rejected_preserved_state");
      const updated = await readLocalDb();
      expect(updated.purchaseOrders.find((p) => p.id === poId)?.status).toBe("pending_approval");
    });
  });

  describe("5. Autonomous Agent ReAct Loop & Persistent Memory", () => {
    it("executes PERCEIVE -> REASON -> PLAN -> ACT -> OBSERVE -> REMEMBER on low-stock Olive Oil", async () => {
      const dbBefore = await readLocalDb();
      const memoryCountBefore = dbBefore.agentMemory.length;

      const { run, toolExecutions } = await runAutonomousAgent({
        objective: "Shelf camera detected critical low stock on Cold Pressed Olive Oil (SKU-OLV-088). Investigate depletion and prepare replenishment.",
        triggerSource: "vitest_integration",
        actorName: managerActor.fullName,
        scenarioContext: {
          sku: "SKU-OLV-088",
          cameraId: "CAM-04",
          shelfOccupancyPct: 12,
        },
      });

      expect(run.plannerMode).toBe("deterministic");
      expect(run.status).toBe("awaiting_approval");

      const phases = new Set(run.steps.map((s) => s.phase));
      expect(phases.has("PERCEIVE")).toBe(true);
      expect(phases.has("REASON")).toBe(true);
      expect(phases.has("PLAN")).toBe(true);
      expect(phases.has("ACT")).toBe(true);
      expect(phases.has("OBSERVE")).toBe(true);
      expect(phases.has("REMEMBER")).toBe(true);

      const toolNames = toolExecutions.map((t) => t.toolName);
      expect(toolNames).toContain("analyze_checkout_and_shelf_feed");
      expect(toolNames).toContain("detect_stock_depletion_velocity");
      expect(toolNames).toContain("dispatch_supplier_purchase_order");
      expect(toolNames).toContain("save_agent_memory");

      const dbAfter = await readLocalDb();
      expect(dbAfter.agentMemory.length).toBeGreaterThan(memoryCountBefore);
    });
  });
});

