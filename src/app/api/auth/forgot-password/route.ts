import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { readLocalDb } from "@/lib/db/local-db";

const ForgotSchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ForgotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();

    if (isSupabaseConfigured()) {
      const { createSupabaseServerClient } = await import("@/lib/db/supabase");
      const supabase = await createSupabaseServerClient();
      const origin = req.nextUrl.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/dashboard`,
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({
        mode: "supabase",
        message: "Password reset link sent via Supabase Auth.",
      });
    }

    const db = await readLocalDb();
    const exists = db.profiles.some((p) => p.email.toLowerCase() === email);
    return NextResponse.json({
      mode: "simulation",
      message: exists
        ? "SIMULATION MODE: Password reset preview generated for demo account (demo accounts continue using password 'demo1234')."
        : "SIMULATION MODE: If an account exists for that email, a simulated reset instruction would be dispatched.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Password reset failed." },
      { status: 500 }
    );
  }
}

