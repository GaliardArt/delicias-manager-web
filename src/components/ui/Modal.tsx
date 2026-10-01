"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
  fixedContent?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = "max-w-md",
  fixedContent = false,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !mounted) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-hidden bg-ink/40 backdrop-blur-sm",
        fixedContent ? "p-2 sm:p-4" : "p-4"
      )}
    >
      <button
        aria-label="Fechar"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div
        className={cn(
          "relative flex w-full min-h-0 flex-col overflow-hidden rounded-2xl bg-surface shadow-soft",
          fixedContent
            ? "h-auto max-h-[calc(100dvh-1rem)] sm:h-[calc(100dvh-2rem)] sm:max-h-[720px]"
            : "h-[calc(100dvh-2rem)] max-h-[720px]",
          maxWidthClassName
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-between border-b border-line",
            fixedContent ? "px-4 py-2.5 sm:py-4" : "px-5 py-4"
          )}
        >
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className={cn(
            fixedContent
              ? "min-h-0 overflow-y-auto overscroll-contain px-3 py-2 sm:flex-1 sm:px-5 sm:py-4"
              : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
