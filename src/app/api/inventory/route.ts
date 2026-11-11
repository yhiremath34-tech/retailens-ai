import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/auth/session";
import { createProductRecord, getFullState } from "@/lib/db/repository";

const CreateProductSchema = z.object({
  sku: z.string().min(3).max(32),
  name: z.string().min(2).max(120),
  barcode: z.string().min(6).max(32),
  category: z.string().min(2).max(60),
  sellingPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  availableQuantity: z.number().int().nonnegative(),
  minStockThreshold: z.number().int().nonnegative(),
  maxStockThreshold: z.number().int().positive(),
  aisleLocation: z.string().min(2).max(80),
  batchNumber: z.string().min(2).max(40),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  primarySupplierId: z.string().min(1),
});

export async function GET() {
  const auth = await requireApiSession("view_dashboard");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const state = await getFullState();
  return NextResponse.json({
    products: state.products,
    movements: state.inventoryMovements,
    suppliers: state.suppliers,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession("manage_inventory");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await req.json();
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid product payload." },
        { status: 400 }
      );
    }
    const created = await createProductRecord(parsed.data, auth.session);
    return NextResponse.json({ product: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create product." },
      { status: 400 }
    );
  }
}

