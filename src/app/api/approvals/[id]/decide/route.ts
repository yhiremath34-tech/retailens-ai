import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { decideApprovalRequest } from "@/lib/db/repository";

const DecideSchema = z.object({
  decision: z.enum(["approved", "rejected", "changes_requested"]),
  notes: z.string().max(500).default(""),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession("approve_requests");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid approval decision." },
        { status: 400 }
      );
    }

    const result = await decideApprovalRequest({
      requestId: id,
      decision: parsed.data.decision,
      notes: parsed.data.notes,
      actor: auth.session,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approval execution failed." },
      { status: 400 }
    );
  }
}

