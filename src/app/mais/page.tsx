"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { moreNavItems } from "@/components/layout/nav-items";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function MaisPage() {
  const { profile, loading } = useUserProfile();
  const visibleItems = loading || !profile
    ? []
    : moreNavItems.filter(
        (item) =>
          item.href === "/perfil" ||
          item.href === "/admin"
            ? item.href === "/admin" ? profile.role === "admin" : true
            : profile.role === "admin" || profile.permissions[item.href.slice(1) as keyof typeof profile.permissions]?.view === true
      );

  return (
    <AppShell title="Mais">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visibleItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="flex flex-col items-center gap-2 py-6 text-center transition-colors hover:bg-surface-muted">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-babypink text-brand-600">
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-ink">{item.label}</span>
            </Card>
          </Link>
        ))}
        <Link href="/configuracoes">
          <Card className="flex flex-col items-center gap-2 py-6 text-center transition-colors hover:bg-surface-muted">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted text-ink-muted">
              <Settings className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-ink">Configurações</span>
          </Card>
        </Link>
      </div>
    </AppShell>
  );
}
