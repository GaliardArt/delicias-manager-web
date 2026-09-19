"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { navItems } from "./nav-items";
import { signOut } from "@/lib/firebase/auth";

export function Sidebar() {
  const pathname = usePathname();
  const settingsItem = navItems.find((item) => item.href === "/configuracoes")!;
  const SettingsIcon = settingsItem.icon;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="text-xl">🍰</span>
        <span className="font-display text-lg font-semibold text-ink">
          Delícias Manager
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navItems
          .filter((item) => item.href !== "/configuracoes")
          .map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-babypink text-brand-700"
                    : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                )}
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-line pt-4">
        <Link
          href="/configuracoes"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/configuracoes")
              ? "bg-babypink text-brand-700"
              : "text-ink-muted hover:bg-surface-muted hover:text-ink"
          )}
        >
          <SettingsIcon className="h-[18px] w-[18px]" />
          Configurações
        </Link>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-danger-500"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sair
        </button>
      </div>
    </aside>
  );
}
