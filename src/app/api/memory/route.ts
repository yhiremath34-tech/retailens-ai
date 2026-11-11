import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { getFullState, saveAgentMemoryRecord } from "@/lib/db/repository";

const CreateMemorySchema = z.object({
  category: z.enum(["inventory", "supplier", "checkout", "pricing", "operational"]),
  sku: z.string().optional(),
  title: z.string().min(3).max(140),
  content: z.string().min(5).max(800),
  relevanceScore: z.number().min(0).max(1).default(0.88),
  influenceNote: z.string().optional(),
});

export async function GET() {
  const auth = await requireApiSession("view_dashboard");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const state = await getFullState();
  return NextResponse.json({ memories: state.agentMemory });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession("manage_inventory");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const parsed = CreateMemorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid memory payload." },
        { status: 400 }
      );
    }
    const created = await saveAgentMemoryRecord(parsed.data);
    return NextResponse.json({ memory: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save memory." },
      { status: 500 }
    );
  }
}

