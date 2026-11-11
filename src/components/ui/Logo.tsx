import React from "react";
import { cn } from "@/lib/utils";

export function RetaiLensLogo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300 bg-gradient-to-br from-sky-100 via-sky-50 to-white shadow-sm">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-sky-600"
        >
          <path
            d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="3.5" stroke="#0284c7" strokeWidth="2" />
          <circle cx="12" cy="12" r="1.2" fill="#38bdf8" />
        </svg>
      </div>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-base font-bold tracking-tight text-slate-950">
            RetaiLens <span className="text-sky-600">AI</span>
          </span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
            Autonomous Ops
          </span>
        </div>
      )}
    </div>
  );
}

