import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { AGENT_TOOLS } from "@/lib/agent/tools";

const DraftPoSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  reason: z.string().min(3).default("Manual reorder draft initiated from Purchase Orders module."),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiSession("create_po");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const parsed = DraftPoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid purchase order payload." },
        { status: 400 }
      );
    }

    const outcome = await AGENT_TOOLS.dispatch_supplier_purchase_order.execute(parsed.data, {
      agentRunId: crypto.randomUUID(),
      actorName: auth.session.fullName,
    });

    return NextResponse.json(outcome, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to draft purchase order." },
      { status: 400 }
    );
  }
}

