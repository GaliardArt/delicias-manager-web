import Link from "next/link";
import { Settings } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { moreNavItems } from "@/components/layout/nav-items";

export default function MaisPage() {
  return (
    <AppShell title="Mais">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {moreNavItems.map((item) => (
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
