"use client";

import { Sparkles } from "lucide-react";

interface WelcomeScreenProps {
  name: string;
  fadingOut?: boolean;
}

export function WelcomeScreen({ name, fadingOut = false }: WelcomeScreenProps) {
  return (
    <div
      className={
        "fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-bg px-6 transition-opacity duration-700 ease-out " +
        (fadingOut ? "pointer-events-none opacity-0" : "opacity-100")
      }
      aria-live="polite"
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="animate-welcome-pop mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-babypink shadow-soft">
          <span className="text-4xl">🍰</span>
        </div>

        <div className="animate-welcome-copy">
          <div className="mb-2 flex items-center justify-center gap-2 text-brand-600">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-semibold tracking-wide">
              Joci Molina - Delicias Artesanais
            </span>
            <Sparkles className="h-4 w-4" />
          </div>

          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Olá, {name}!
          </h1>
          <p className="mt-3 text-base text-ink-muted sm:text-lg">
            Como está seu dia hoje?
          </p>
        </div>
      </div>
    </div>
  );
}
