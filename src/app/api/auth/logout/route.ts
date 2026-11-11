import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST() {
  if (isSupabaseConfigured()) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/db/supabase");
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore if session already expired
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}

