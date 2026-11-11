import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { resetDemoState, updatePricingRulesRecord } from "@/lib/db/repository";
import { isSupabaseConfigured } from "@/lib/env";
import { withLocalDbTransaction } from "@/lib/db/local-db";
import { createSupabaseAdminClient } from "@/lib/db/supabase";
import { DEMO_STORE_ID } from "@/lib/seed-data";

const RulesPatchSchema = z.object({
  minMarginPct: z.number().min(0).max(80).optional(),
  autoApproveMaxDiscountPct: z.number().min(0).max(70).optional(),
  expiryAlertWindowDays: z.number().int().min(1).max(60).optional(),
  poAutoApproveLimit: z.number().nonnegative().optional(),
  inventoryAdjustApprovalThreshold: z.number().int().positive().optional(),
  gstRatePct: z.number().min(0).max(30).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession("manage_settings");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const parsed = RulesPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid rules settings." },
        { status: 400 }
      );
    }

    const { gstRatePct, ...rulesPatch } = parsed.data;
    if (gstRatePct !== undefined) {
      if (isSupabaseConfigured()) {
        const sb = createSupabaseAdminClient();
        await sb.from("stores").update({ gst_rate_pct: gstRatePct }).eq("id", DEMO_STORE_ID);
      } else {
        await withLocalDbTransaction((s) => {
          s.store.gstRatePct = gstRatePct;
        });
      }
    }

    const updatedRules = await updatePricingRulesRecord(rulesPatch, auth.session);
    return NextResponse.json({ rules: updatedRules });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save settings." },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession("run_demo");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    if (body.action === "reset_demo") {
      const state = await resetDemoState(auth.session);
      return NextResponse.json({ ok: true, state });
    }
    return NextResponse.json({ error: "Unknown settings action." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Settings action failed." },
      { status: 400 }
    );
  }
}

