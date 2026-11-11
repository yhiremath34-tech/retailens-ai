import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifyPassword,
} from "@/lib/auth/session";
import { readLocalDb } from "@/lib/db/local-db";
import { DEMO_STORE_ID } from "@/lib/seed-data";
import { UserRole } from "@/types/retailens";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

const DEMO_PASSWORDS: Record<string, string> = {
  "owner@retailens.demo": "demo1234",
  "manager@retailens.demo": "demo1234",
  "inventory@retailens.demo": "demo1234",
  "cashier@retailens.demo": "demo1234",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please enter a valid email and password (minimum 4 characters)." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;

    if (isSupabaseConfigured()) {
      const { createSupabaseServerClient } = await import("@/lib/db/supabase");
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message || "Invalid Supabase credentials." },
          { status: 401 }
        );
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      return NextResponse.json({
        user: {
          id: data.user.id,
          email: data.user.email,
          fullName: profile?.full_name || data.user.user_metadata?.full_name || "Store Staff",
          role: (profile?.role as UserRole) || "cashier",
          storeId: profile?.store_id || DEMO_STORE_ID,
          authMode: "supabase",
        },
      });
    }

    const db = await readLocalDb();
    const profile = db.profiles.find((p) => p.email.toLowerCase() === email);
    if (!profile) {
      return NextResponse.json({ error: "No account found for that email." }, { status: 401 });
    }

    const validSeed = DEMO_PASSWORDS[email] === password;
    const validHashed = profile.passwordHash ? verifyPassword(password, profile.passwordHash) : false;
    if (!validSeed && !validHashed) {
      return NextResponse.json({ error: "Invalid password." }, { status: 401 });
    }

    const session = {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      storeId: profile.storeId || DEMO_STORE_ID,
      authMode: "simulation" as const,
    };

    const token = signSessionToken(session);
    const res = NextResponse.json({ user: session });
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed." },
      { status: 500 }
    );
  }
}

