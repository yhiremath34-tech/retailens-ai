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
        "rounded-xl border border-slate-800/90 bg-[#0f1623] p-5 shadow-sm transition-colors",
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
    neutral: "border-slate-700 bg-slate-800/80 text-slate-300",
    blue: "border-blue-500/30 bg-blue-500/15 text-blue-300",
    cyan: "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
    green: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/15 text-amber-300",
    red: "border-rose-500/30 bg-rose-500/15 text-rose-300",
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
        "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50",
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
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-xl border border-slate-800 bg-slate-900/70", className)}
    />
  );
}

