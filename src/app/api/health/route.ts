import { NextResponse } from "next/server";
import { getSystemModes } from "@/lib/db/repository";

export async function GET() {
  const modes = await getSystemModes();
  return NextResponse.json({
    ok: true,
    service: "RetaiLens AI",
    modes,
    timestamp: new Date().toISOString(),
  });
}

