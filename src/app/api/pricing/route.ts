import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import {
  addAuditLog,
  getFullState,
  saveApprovalRequestRecord,
  updateProductRecord,
} from "@/lib/db/repository";
import { isSupabaseConfigured } from "@/lib/env";
import { withLocalDbTransaction } from "@/lib/db/local-db";
import { createSupabaseAdminClient } from "@/lib/db/supabase";
import { DEMO_STORE_ID } from "@/lib/seed-data";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  const auth = await requireApiSession("manage_inventory");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const action = String(body.action || "scan");

    if (action === "scan") {
      const outcome = await AGENT_TOOLS.calculate_dynamic_expiry_discount.execute(
        { sku: body.sku ? String(body.sku) : undefined },
        { agentRunId: crypto.randomUUID(), actorName: auth.session.fullName }
      );
      return NextResponse.json(outcome);
    }

    if (action === "apply") {
      const recommendationId = String(body.recommendationId || "");
      const state = await getFullState();
      const rec = state.priceRecommendations.find((r) => r.id === recommendationId);
      if (!rec) {
        return NextResponse.json({ error: "Price recommendation not found." }, { status: 404 });
      }

      if (rec.requiresApproval && !["store_owner", "store_manager"].includes(auth.session.role)) {
        // Queue for manager approval if not already queued
        const existingPending = state.approvalRequests.find(
          (a) => a.referenceId === rec.id && a.status === "pending"
        );
        if (!existingPending) {
          await saveApprovalRequestRecord({
            id: crypto.randomUUID(),
            storeId: DEMO_STORE_ID,
            agentRunId: null,
            actionType: "high_impact_price_change",
            productId: rec.productId,
            sku: rec.sku,
            productName: rec.productName,
            referenceId: rec.id,
            proposedChange: `Apply ${rec.discountPct}% dynamic discount on ${rec.productName} (₹${rec.originalPrice} → ₹${rec.recommendedPrice}).`,
            financialImpact: rec.originalPrice - rec.recommendedPrice,
            agentExplanation: rec.reason,
            evidence: { discountPct: rec.discountPct },
            riskLevel: "medium",
            status: "pending",
            payload: {
              recommendationId: rec.id,
              productId: rec.productId,
              newPrice: rec.recommendedPrice,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        return NextResponse.json(
          {
            requiresApproval: true,
            message:
              "Discount exceeds autonomous pricing limit and requires Store Manager approval in Approval Center.",
          },
          { status: 202 }
        );
      }

      await updateProductRecord(
        rec.productId,
        { sellingPrice: rec.recommendedPrice },
        auth.session
      );

      if (isSupabaseConfigured()) {
        const sb = createSupabaseAdminClient();
        await sb
          .from("price_recommendations")
          .update({ status: "applied" })
          .eq("id", rec.id);
      } else {
        await withLocalDbTransaction((s) => {
          const target = s.priceRecommendations.find((r) => r.id === rec.id);
          if (target) target.status = "applied";
        });
      }

      await addAuditLog({
        actorId: auth.session.id,
        actorRole: auth.session.role,
        eventCategory: "pricing",
        action: "dynamic_discount_applied",
        entityType: "price_recommendation",
        entityId: rec.id,
        summary: `${auth.session.fullName} applied ${rec.discountPct}% markdown on ${rec.sku} (₹${rec.originalPrice} → ₹${rec.recommendedPrice}).`,
        details: { recId: rec.id, sku: rec.sku },
      });

      return NextResponse.json({ ok: true, appliedPrice: rec.recommendedPrice });
    }

    return NextResponse.json({ error: "Unsupported pricing action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pricing operation failed." },
      { status: 400 }
    );
  }
}

