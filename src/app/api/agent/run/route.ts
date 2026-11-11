import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { runAutonomousAgent } from "@/lib/agent/orchestrator";

const AgentRunSchema = z.object({
  objective: z.string().min(4).max(500),
  triggerSource: z.string().default("manual"),
  scenarioContext: z
    .object({
      sku: z.string().optional(),
      cameraId: z.string().optional(),
      posBarcode: z.string().optional(),
      visualConfidencePct: z.number().optional(),
      shelfOccupancyPct: z.number().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiSession("run_agent");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const parsed = AgentRunSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid agent objective." },
        { status: 400 }
      );
    }

    const result = await runAutonomousAgent({
      objective: parsed.data.objective,
      triggerSource: parsed.data.triggerSource,
      actorName: `${auth.session.fullName} via RetaiLens Agent`,
      scenarioContext: parsed.data.scenarioContext,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent execution failed." },
      { status: 500 }
    );
  }
}

