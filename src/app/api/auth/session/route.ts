import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/session";
import { getSystemModes } from "@/lib/db/repository";

export async function GET() {
  const [session, modes] = await Promise.all([getServerSession(), getSystemModes()]);
  return NextResponse.json({ session, modes });
}

