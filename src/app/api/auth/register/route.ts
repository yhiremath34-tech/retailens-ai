import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import {
  hashPassword,
  SESSION_COOKIE_NAME,
  signSessionToken,
} from "@/lib/auth/session";
import { withLocalDbTransaction } from "@/lib/db/local-db";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/db/supabase";
import { DEMO_STORE_ID } from "@/lib/seed-data";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2).max(80),
  role: z.enum(["store_owner", "store_manager", "inventory_manager", "cashier"]).default("cashier"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid registration fields." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const { password, fullName, role } = parsed.data;

    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, role } },
      });
      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message || "Unable to register user." },
          { status: 400 }
        );
      }

      const admin = createSupabaseAdminClient();
      await admin.from("profiles").upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        role,
        store_id: DEMO_STORE_ID,
      });

      return NextResponse.json({
        user: {
          id: data.user.id,
          email,
          fullName,
          role,
          storeId: DEMO_STORE_ID,
          authMode: "supabase",
        },
      });
    }

    const session = await withLocalDbTransaction((state) => {
      if (state.profiles.some((p) => p.email.toLowerCase() === email)) {
        throw new Error("An account with this email already exists.");
      }
      const id = crypto.randomUUID();
      state.profiles.push({
        id,
        email,
        passwordHash: hashPassword(password),
        fullName,
        role,
        storeId: DEMO_STORE_ID,
      });
      return {
        id,
        email,
        fullName,
        role,
        storeId: DEMO_STORE_ID,
        authMode: "simulation" as const,
      };
    });

    const token = signSessionToken(session);
    const res = NextResponse.json({ user: session }, { status: 201 });
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
      { error: err instanceof Error ? err.message : "Registration failed." },
      { status: 400 }
    );
  }
}

