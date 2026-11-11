import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { deleteProductRecord, updateProductRecord } from "@/lib/db/repository";

const UpdateProductSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.string().min(2).max(60).optional(),
  sellingPrice: z.number().nonnegative().optional(),
  costPrice: z.number().nonnegative().optional(),
  availableQuantity: z.number().int().nonnegative().optional(),
  minStockThreshold: z.number().int().nonnegative().optional(),
  maxStockThreshold: z.number().int().positive().optional(),
  aisleLocation: z.string().min(2).max(80).optional(),
  batchNumber: z.string().min(2).max(40).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  primarySupplierId: z.string().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession("manage_inventory");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid update fields." },
        { status: 400 }
      );
    }

    const updated = await updateProductRecord(id, parsed.data, auth.session);
    return NextResponse.json({ product: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update product." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession("delete_inventory");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await context.params;
    await deleteProductRecord(id, auth.session);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete product." },
      { status: 400 }
    );
  }
}

