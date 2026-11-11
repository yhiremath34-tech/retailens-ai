import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import {
  addAuditLog,
  getFullState,
  mutateInventory,
  saveApprovalRequestRecord,
  saveCheckoutAndDispute,
} from "@/lib/db/repository";
import { DEMO_STORE_ID } from "@/lib/seed-data";

const CheckoutSchema = z.object({
  cameraId: z.string().default("CAM-CHK-01"),
  items: z
    .array(
      z.object({
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
        posPrice: z.number().nonnegative().optional(),
        scannedBarcode: z.string().optional(),
        visualConfidence: z.number().min(0).max(100).default(96.5),
      })
    )
    .min(1),
  gstRatePct: z.number().min(0).max(30).optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiSession("process_checkout");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid checkout payload." },
        { status: 400 }
      );
    }

    const state = await getFullState();
    const gstRate = parsed.data.gstRatePct ?? state.store.gstRatePct;
    const sessionId = crypto.randomUUID();
    const sessionCode = `CHK-01-${Math.floor(3000 + Math.random() * 6999)}`;
    const now = new Date().toISOString();

    let hasAnomaly = false;
    let anomalyReason: string | null = null;
    let minConfidence = 100;
    let subtotal = 0;

    const resolvedItems = parsed.data.items.map((item) => {
      const prod = state.products.find(
        (p) => p.sku.toLowerCase() === item.sku.toLowerCase()
      );
      if (!prod) throw new Error(`Unknown SKU '${item.sku}' in checkout basket.`);

      const scannedBarcode = item.scannedBarcode || prod.barcode;
      const posPrice = item.posPrice ?? prod.sellingPrice;
      const barcodeMismatch = scannedBarcode !== prod.barcode;
      const priceDiscrepancy = Math.abs(posPrice - prod.sellingPrice) > 0.01;
      const lowConfidence = item.visualConfidence < 80;

      const matchStatus = lowConfidence
        ? ("low_confidence" as const)
        : barcodeMismatch
        ? ("barcode_mismatch" as const)
        : priceDiscrepancy
        ? ("price_discrepancy" as const)
        : ("matched" as const);

      if (matchStatus !== "matched") {
        hasAnomaly = true;
        anomalyReason = `Item ${prod.sku} flagged as '${matchStatus}' (confidence=${item.visualConfidence}%, POS=₹${posPrice}, Expected=₹${prod.sellingPrice}).`;
      }

      minConfidence = Math.min(minConfidence, item.visualConfidence);
      subtotal += posPrice * item.quantity;

      return {
        id: crypto.randomUUID(),
        checkoutSessionId: sessionId,
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        scannedBarcode,
        expectedPrice: prod.sellingPrice,
        posPrice,
        quantity: item.quantity,
        visualConfidence: item.visualConfidence,
        matchStatus,
      };
    });

    subtotal = Number(subtotal.toFixed(2));
    const gstAmount = Number(((subtotal * gstRate) / 100).toFixed(2));
    const totalAmount = Number((subtotal + gstAmount).toFixed(2));

    const session = {
      id: sessionId,
      sessionCode,
      storeId: DEMO_STORE_ID,
      cashierId: `${auth.session.fullName} (${auth.session.role})`,
      cameraId: parsed.data.cameraId,
      status: hasAnomaly ? ("paused_review" as const) : ("completed" as const),
      visualConfidence: minConfidence,
      subtotal,
      gstAmount,
      totalAmount,
      anomalyReason,
      items: resolvedItems,
      createdAt: now,
      updatedAt: now,
    };

    if (hasAnomaly) {
      const firstAnomalous = resolvedItems.find((i) => i.matchStatus !== "matched")!;
      const disputeId = crypto.randomUUID();
      const dispute = {
        id: disputeId,
        storeId: DEMO_STORE_ID,
        checkoutSessionId: sessionId,
        sessionCode,
        disputeType:
          firstAnomalous.matchStatus === "matched"
            ? ("low_confidence" as const)
            : firstAnomalous.matchStatus,
        description: anomalyReason || "Checkout verification flagged anomaly.",
        evidence: {
          cameraId: parsed.data.cameraId,
          items: resolvedItems,
        },
        status: "pending_approval" as const,
        resolutionNotes: null,
        resolvedBy: null,
        createdAt: now,
        updatedAt: now,
      };

      await saveCheckoutAndDispute(session, dispute);
      const approval = await saveApprovalRequestRecord({
        id: crypto.randomUUID(),
        storeId: DEMO_STORE_ID,
        agentRunId: null,
        actionType: "checkout_dispute_override",
        productId: firstAnomalous.productId,
        sku: firstAnomalous.sku,
        productName: firstAnomalous.productName,
        referenceId: disputeId,
        proposedChange: `Review paused checkout ${sessionCode} (${firstAnomalous.matchStatus}) before mutating inventory.`,
        financialImpact: Math.abs(firstAnomalous.expectedPrice - firstAnomalous.posPrice),
        agentExplanation: anomalyReason || "Low-confidence or mismatched checkout scan paused automatically.",
        evidence: { sessionCode, items: resolvedItems },
        riskLevel: "medium",
        status: "pending",
        payload: {
          disputeId,
          checkoutSessionId: sessionId,
          productId: firstAnomalous.productId,
          sku: firstAnomalous.sku,
        },
        createdAt: now,
        updatedAt: now,
      });

      await addAuditLog({
        actorId: auth.session.id,
        actorRole: auth.session.role,
        eventCategory: "checkout",
        action: "checkout_paused_anomaly",
        entityType: "checkout_session",
        entityId: sessionId,
        summary: `Paused checkout ${sessionCode}: ${anomalyReason}`,
        details: { approvalId: approval.id },
      });

      return NextResponse.json({ session, dispute, approval, inventoryMutated: false });
    }

    // Verified standard checkout -> deduct inventory atomically!
    await saveCheckoutAndDispute(session, null);
    for (const item of resolvedItems) {
      if (item.productId) {
        await mutateInventory({
          productId: item.productId,
          quantityDelta: -item.quantity,
          movementType: "sale_deduction",
          reason: `Verified POS checkout ${sessionCode}`,
          referenceType: "checkout_session",
          referenceId: sessionId,
          idempotencyKey: parsed.data.idempotencyKey
            ? `${parsed.data.idempotencyKey}-${item.sku}`
            : `chk-${sessionId}-${item.sku}`,
          performedBy: auth.session.fullName,
        });
      }
    }

    await addAuditLog({
      actorId: auth.session.id,
      actorRole: auth.session.role,
      eventCategory: "checkout",
      action: "checkout_completed",
      entityType: "checkout_session",
      entityId: sessionId,
      summary: `Verified checkout ${sessionCode} completed (₹${totalAmount}) and inventory deducted.`,
      details: { totalAmount, itemCount: resolvedItems.length },
    });

    return NextResponse.json({ session, inventoryMutated: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout processing failed." },
      { status: 400 }
    );
  }
}

