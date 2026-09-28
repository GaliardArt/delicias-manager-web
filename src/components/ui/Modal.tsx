"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = "max-w-md",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-hidden bg-ink/40 p-4 backdrop-blur-sm">
      <button
        aria-label="Fechar"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div
        className={cn(
          "relative flex max-h-[calc(100dvh-2rem)] w-full min-h-0 flex-col overflow-hidden rounded-2xl bg-surface shadow-soft",
          maxWidthClassName
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
