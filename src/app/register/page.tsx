"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { RetaiLensLogo } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/ToastProvider";
import { UserRole } from "@/types/retailens";

export default function RegisterPage() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("store_manager");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string; password?: string }>({});

  function validateField(field: "fullName" | "email" | "password", val: string): string | undefined {
    if (field === "fullName" && val.trim().length < 2) return "Full name must be at least 2 characters.";
    if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return "Enter a valid work email address.";
    if (field === "password" && val.length < 6) return "Password must be at least 6 characters.";
    return undefined;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed.");
        return;
      }
      pushToast({
        kind: "success",
        title: "Account created",
        message: `Signed in as ${data.user.fullName} (${data.user.role}).`,
      });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error during registration.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvb] flex-col items-center justify-center bg-slate-50/70 px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <Link href="/">
          <RetaiLensLogo />
        </Link>

        <div>
          <h1 className="text-xl font-bold text-slate-950">Create Staff Account</h1>
          <p className="mt-1 text-sm text-slate-600">
            Server-side role permissions protect approvals, pricing rules, and inventory deletions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-xs font-medium text-slate-700">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (fieldErrors.fullName) {
                  setFieldErrors((prev) => ({ ...prev, fullName: validateField("fullName", e.target.value) }));
                }
              }}
              onBlur={(e) =>
                setFieldErrors((prev) => ({ ...prev, fullName: validateField("fullName", e.target.value) }))
              }
              aria-invalid={Boolean(fieldErrors.fullName)}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
            {fieldErrors.fullName && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {fieldErrors.fullName}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reg-email" className="mb-1.5 block text-xs font-medium text-slate-700">
              Work email
            </label>
            <input
              id="reg-email"
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
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
            {fieldErrors.email && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="reg-role" className="mb-1.5 block text-xs font-medium text-slate-700">
              Store Role
            </label>
            <select
              id="reg-role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            >
              <option value="store_owner">Store Owner</option>
              <option value="store_manager">Store Manager</option>
              <option value="inventory_manager">Inventory Manager</option>
              <option value="cashier">Cashier</option>
            </select>
          </div>

          <div>
            <label htmlFor="reg-password" className="mb-1.5 block text-xs font-medium text-slate-700">
              Password (minimum 6 characters)
            </label>
            <input
              id="reg-password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
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
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
            {fieldErrors.password && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          <PrimaryButton type="submit" disabled={submitting} className="w-full min-h-[44px]">
            <UserPlus className="h-4 w-4" />
            {submitting ? "Creating account..." : "Create Account"}
          </PrimaryButton>
        </form>

        <p className="text-center text-xs text-slate-600">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-sky-700 hover:text-sky-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

