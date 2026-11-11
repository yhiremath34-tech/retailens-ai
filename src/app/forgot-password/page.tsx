"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { RetaiLensLogo } from "@/components/ui/Logo";
import { PrimaryButton } from "@/components/ui/primitives";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setStatusMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to send reset request.");
        return;
      }
      setStatusMessage(data.message);
    } catch {
      setError("Network error.");
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
          <h1 className="text-xl font-bold text-slate-950">Reset Password</h1>
          <p className="mt-1 text-sm text-slate-600">
            Enter your account email to request a password reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-email" className="mb-1.5 block text-xs font-medium text-slate-700">
              Email address
            </label>
            <input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim())) {
                  setEmailError("");
                }
              }}
              onBlur={(e) => {
                if (!e.target.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value.trim())) {
                  setEmailError("Enter a valid email address.");
                } else {
                  setEmailError("");
                }
              }}
              aria-invalid={Boolean(emailError)}
              className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
            {emailError && (
              <p role="alert" className="mt-1 text-xs text-rose-600">
                {emailError}
              </p>
            )}
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
              {error}
            </div>
          )}
          {statusMessage && (
            <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
              {statusMessage}
            </div>
          )}

          <PrimaryButton type="submit" disabled={submitting} className="w-full min-h-[44px]">
            <Mail className="h-4 w-4" />
            {submitting ? "Requesting..." : "Send Reset Link"}
          </PrimaryButton>
        </form>

        <p className="text-center text-xs text-slate-600">
          Return to{" "}
          <Link href="/login" className="font-medium text-sky-700 hover:text-sky-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

