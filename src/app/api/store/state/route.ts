import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getFullState, getSystemModes } from "@/lib/db/repository";

export async function GET() {
  const auth = await requireApiSession("view_dashboard");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [state, modes] = await Promise.all([getFullState(), getSystemModes()]);
    return NextResponse.json({
      session: auth.session,
      modes,
      state,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load store state." },
      { status: 500 }
    );
  }
}

