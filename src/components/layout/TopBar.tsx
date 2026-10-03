"use client";

import { RefreshCw, Settings } from "lucide-react";
import Link from "next/link";
import type { UserProfile } from "@/lib/firebase/users";

interface TopBarProps {
  title: string;
  profile: UserProfile | null;
  fallbackName: string | null;
  fallbackEmail: string | null;
}

export function TopBar({
  title,
  profile,
  fallbackName,
  fallbackEmail,
}: TopBarProps) {
  const displayName =
    profile?.name?.trim() ||
    fallbackName?.trim() ||
    profile?.email?.split("@")[0] ||
    fallbackEmail?.split("@")[0] ||
    "Usuário";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 pb-3.5 backdrop-blur md:hidden"
      style={{ paddingTop: "max(0.875rem, env(safe-area-inset-top, 0px))" }}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-lg">🍰</span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold text-ink">{title}</h1>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success-500" />
            </span>
            <span className="truncate text-[10px] font-medium text-success-700">
              {displayName} · Online
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex h-9 items-center gap-1.5 rounded-full bg-babypink px-3 text-xs font-medium text-brand-700"
        aria-label="Atualizar dados"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Atualizar
      </button>
      <Link
        href="/configuracoes"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
        aria-label="Configurações"
      >
        <Settings className="h-[18px] w-[18px]" />
      </Link>
      </div>
    </header>
  );
}
