import React from "react";
import { cn } from "@/lib/utils";

export function PanelCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm transition-colors",
        className
      )}
    >
      {children}
    </div>
  );
}

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "blue" | "cyan" | "green" | "amber" | "red";
  children: React.ReactNode;
  className?: string;
}) {
  const styles: Record<string, string> = {
    neutral: "border-slate-300 bg-slate-100 text-slate-800",
    blue: "border-sky-300 bg-sky-100 text-sky-950",
    cyan: "border-sky-300 bg-sky-50 text-sky-900",
    green: "border-emerald-300 bg-emerald-50 text-emerald-900",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    red: "border-rose-300 bg-rose-50 text-rose-900",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        styles[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-sky-400 bg-sky-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-sky-400 active:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-4 py-2 text-sm font-medium text-sky-950 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SectionHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-xl border border-slate-200 bg-slate-100", className)}
    />
  );
}

