"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useUserProfile } from "@/hooks/useUserProfile";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { profile } = useUserProfile();
  const displayName =
    profile?.name?.trim() || profile?.email?.split("@")[0] || "Usuário";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3.5 backdrop-blur md:hidden">
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
      <Link
        href="/configuracoes"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
        aria-label="Configurações"
      >
        <Settings className="h-[18px] w-[18px]" />
      </Link>
    </header>
  );
}
