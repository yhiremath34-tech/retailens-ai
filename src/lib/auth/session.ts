import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getAuthSecret, isSupabaseConfigured } from "@/lib/env";
import { PermissionAction, hasPermission } from "@/lib/auth/rbac";
import { UserRole, UserSession } from "@/types/retailens";
import { DEMO_STORE_ID } from "@/lib/seed-data";

export const SESSION_COOKIE_NAME = "retailens_session";

export const DEFAULT_WORKSPACE_SESSION: UserSession = {
  id: "00000000-0000-4000-8000-000000000002",
  email: "manager@retailens.demo",
  fullName: "Ananya Rao",
  role: "store_manager",
  storeId: DEMO_STORE_ID,
  authMode: "simulation",
};

interface TokenPayload {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  storeId: string;
  authMode: "supabase" | "simulation";
  exp: number;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hash, "hex");
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function signSessionToken(session: UserSession): string {
  const payload: TokenPayload = {
    ...session,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): UserSession | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getAuthSecret())
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      fullName: parsed.fullName,
      role: parsed.role,
      storeId: parsed.storeId || DEMO_STORE_ID,
      authMode: parsed.authMode || "simulation",
    };
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const simCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const parsed = verifySessionToken(simCookie);
  if (parsed) return parsed;

  if (isSupabaseConfigured()) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/db/supabase");
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, store_id")
        .eq("id", user.id)
        .single();

      return {
        id: user.id,
        email: profile?.email || user.email || "",
        fullName: profile?.full_name || user.user_metadata?.full_name || "Store Staff",
        role: (profile?.role as UserRole) || "cashier",
        storeId: profile?.store_id || DEMO_STORE_ID,
        authMode: "supabase",
      };
    } catch {
      return DEFAULT_WORKSPACE_SESSION;
    }
  }

  return DEFAULT_WORKSPACE_SESSION;
}

export async function requireApiSession(
  requiredPermission?: PermissionAction
): Promise<{ session: UserSession } | { error: string; status: 401 | 403 }> {
  const session = await getServerSession();
  if (!session) {
    return { error: "Authentication required. Please sign in to continue.", status: 401 };
  }
  if (requiredPermission && !hasPermission(session.role, requiredPermission)) {
    return {
      error: `Access denied for role '${session.role}'. Required permission: '${requiredPermission}'.`,
      status: 403,
    };
  }
  return { session };
}

