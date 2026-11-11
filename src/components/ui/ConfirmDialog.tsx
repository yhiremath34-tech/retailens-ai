"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export function ModalDialog({
  open,
  onClose,
  title,
  children,
  lightDismiss = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  lightDismiss?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => {
      el.returnValue = "";
      onClose();
    };
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  const isOutside = (e: React.PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      {...(lightDismiss ? ({ closedby: "any" } as Record<string, string>) : {})}
      onPointerDown={(e) => {
        if (!lightDismiss || !ref.current) return;
        pressedOutsideRef.current = isOutside(e, ref.current);
      }}
      onPointerUp={(e) => {
        if (!lightDismiss || !ref.current) return;
        if (pressedOutsideRef.current && isOutside(e, ref.current)) {
          ref.current.close();
        }
        pressedOutsideRef.current = false;
      }}
      className="w-full"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close modal"
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

