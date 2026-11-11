"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastKind = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  title: string;
  message?: string;
  kind: ToastKind;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue>({
  pushToast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  const openPopover = useCallback(() => {
    const el = popoverRef.current;
    if (!el) return;
    if (typeof el.showPopover === "function") {
      try {
        el.showPopover();
      } catch {
        // Ignore if already open
      }
    } else {
      el.classList.add(":popover-open");
    }
  }, []);

  const closePopover = useCallback(() => {
    const el = popoverRef.current;
    if (!el) return;
    if (typeof el.hidePopover === "function") {
      try {
        el.hidePopover();
      } catch {
        // Ignore if already closed
      }
    } else {
      el.classList.remove(":popover-open");
    }
  }, []);

  useEffect(() => {
    if (toasts.length === 0) {
      closePopover();
    }
  }, [toasts.length, closePopover]);

  const dismiss = useCallback(
    (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    []
  );

  const pushToast = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev.slice(-3), { id, ...toast }]);
      openPopover();
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss, openPopover]
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        ref={popoverRef}
        id="retailens-toast-stack"
        {...({ popover: "manual" } as Record<string, string>)}
        aria-live="polite"
        className="toast-popover z-50 space-y-2 p-2"
      >
        {toasts.map((t) => {
          const border =
            t.kind === "success"
              ? "border-emerald-300 bg-emerald-50/95"
              : t.kind === "error"
              ? "border-rose-300 bg-rose-50/95"
              : t.kind === "warning"
              ? "border-amber-300 bg-amber-50/95"
              : "border-sky-300 bg-white/95";
          const Icon =
            t.kind === "success"
              ? CheckCircle2
              : t.kind === "error"
              ? XCircle
              : t.kind === "warning"
              ? AlertTriangle
              : Info;
          const iconColor =
            t.kind === "success"
              ? "text-emerald-600"
              : t.kind === "error"
              ? "text-rose-600"
              : t.kind === "warning"
              ? "text-amber-600"
              : "text-sky-600";

          return (
            <div
              key={t.id}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur ${border}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                {t.message && <p className="mt-0.5 text-xs text-slate-600">{t.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Close notification"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

