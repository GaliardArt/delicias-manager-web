"use client";

import { Settings } from "lucide-react";
import Link from "next/link";

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3.5 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        <span className="text-lg">🍰</span>
        <h1 className="font-display text-base font-semibold text-ink">{title}</h1>
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
