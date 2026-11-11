"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Shield } from "lucide-react";
import { RetaiLensLogo } from "@/components/ui/Logo";
import { PrimaryButton, SecondaryButton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";

const DEMO_ACCOUNTS = [
  { label: "Store Owner", email: "owner@retailens.demo", role: "Full Access & Approvals" },
  { label: "Store Manager", email: "manager@retailens.demo", role: "Approvals & Pricing" },
  { label: "Inventory Mgr", email: "inventory@retailens.demo", role: "Stock & PO Drafts" },
  { label: "Cashier", email: "cashier@retailens.demo", role: "POS Checkout Only" },
];

export default function LoginPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [email, setEmail] = useState("manager@retailens.demo");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [authMode, setAuthMode] = useState<"simulation" | "supabase">("simulation");

  function validateField(field: "email" | "password", val: string): string | undefined {
    if (field === "email") {
      if (!val.trim()) return "Email address is required.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return "Enter a valid email address.";
    } else if (field === "password") {
      if (val.length < 4) return "Password must be at least 4 characters.";
    }
    return undefined;
  }

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.modes?.authMode) setAuthMode(d.modes.authMode);
        if (d.session) router.replace("/dashboard");
      })
      .catch(() => undefined);
  }, [router]);

  async function submitLogin(targetEmail: string, targetPassword: string) {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed.");
        return;
      }
      pushToast({
        kind: "success",
        title: `Signed in as ${data.user.fullName}`,
        message: `Role: ${data.user.role}`,
      });
      const params = new URLSearchParams(window.location.search);
      const nextPath = params.get("redirect") || params.get("next") || "/dashboard";
      router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error while signing in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvb] flex-col items-center justify-center bg-[#090d14] px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-[#0f1623] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between">
          <Link href="/">
            <RetaiLensLogo />
          </Link>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300">
            {authMode === "supabase" ? "Supabase Auth" : "Simulation Auth"}
          </span>
        </div>

        <div>
          <h1 className="text-xl font-bold text-white">Sign in to Command Center</h1>
          <p className="mt-1 text-sm text-slate-400">
            Access Retail Demo Market – Store 01 with role-enforced permissions.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitLogin(email, password);
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-slate-300">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: validateField("email", e.target.value) }));
                }
              }}
              onBlur={(e) =>
                setFieldErrors((prev) => ({ ...prev, email: validateField("email", e.target.value) }))
              }
              aria-invalid={Boolean(fieldErrors.email)}
              className="min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            {fieldErrors.email && (
              <p role="alert" className="mt-1 text-xs text-rose-400">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-blue-400 hover:text-blue-300"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={4}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: validateField("password", e.target.value) }));
                  }
                }}
                onBlur={(e) =>
                  setFieldErrors((prev) => ({ ...prev, password: validateField("password", e.target.value) }))
                }
                aria-invalid={Boolean(fieldErrors.password)}
                className="min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 pr-11 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-1 flex items-center px-2.5 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p role="alert" className="mt-1 text-xs text-rose-400">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {error}
            </div>
          )}

          <PrimaryButton type="submit" disabled={submitting} className="w-full min-h-[44px]">
            <KeyRound className="h-4 w-4" />
            {submitting ? "Signing in..." : "Sign In"}
          </PrimaryButton>
        </form>

        {/* Google OAuth notice / button */}
        <SecondaryButton
          type="button"
          className="w-full min-h-[42px] text-xs"
          onClick={() =>
            pushToast({
              kind: "info",
              title: "Google OAuth Requires Supabase Google Provider",
              message:
                "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true in production to enable Google SSO. Use email or demo role presets below.",
            })
          }
        >
          Continue with Google (Configured via Supabase OAuth)
        </SecondaryButton>

        {/* Role Quick-Login Presets */}
        <div className="border-t border-slate-800 pt-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Shield className="h-3.5 w-3.5 text-cyan-400" />
            Quick Role Demo Sign-In (Password: demo1234)
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={submitting}
                onClick={() => {
                  setEmail(acc.email);
                  setPassword("demo1234");
                  submitLogin(acc.email, "demo1234");
                }}
                className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 text-left transition hover:border-blue-500/40 hover:bg-slate-800"
              >
                <p className="text-xs font-semibold text-slate-100">{acc.label}</p>
                <p className="text-[11px] text-slate-400">{acc.role}</p>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          Need a staff account?{" "}
          <Link href="/register" className="font-medium text-cyan-400 hover:text-cyan-300">
            Register new user
          </Link>
        </p>
      </div>
    </div>
  );
}

