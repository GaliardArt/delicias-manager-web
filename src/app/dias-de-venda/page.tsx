"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, History, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { getOpenDayGroups, todayIso, OpenDayGroup } from "@/lib/firebase/sales-days";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";

export default function DiasDeVendaPage() {
  const [groups, setGroups] = useState<OpenDayGroup[] | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    setGroups(null);
    try {
      setGroups(await getOpenDayGroups());
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const today = todayIso();

  return (
    <AppShell title="Dias de Venda">
      <p className="mb-4 text-sm text-ink-muted">
        Gerado automaticamente a partir das encomendas e vendas registradas — um
        resumo do que está previsto ou já foi vendido em cada dia.
      </p>

      <div className="mb-4">
        <Link
          href="/dias-de-venda/historico"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <History className="h-3.5 w-3.5" /> Ver histórico de dias encerrados
        </Link>
      </div>

      {groups === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar os Dias de Venda"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {groups !== null && !error && groups.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum Dia de Venda em aberto"
          description="Assim que houver uma encomenda ou venda para uma data, o dia aparece aqui automaticamente."
        />
      )}

      {groups && groups.length > 0 && (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const isPast = group.date < today;
            const isToday = group.date === today;
            return (
              <Link key={group.date} href={`/dias-de-venda/aberto/${group.date}`}>
                <Card className="transition-colors hover:bg-surface-muted">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-base font-semibold text-ink">
                        {formatDateBR(group.date)}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {group.orders.length > 0 &&
                          `${group.orders.length} ${
                            group.orders.length === 1 ? "encomenda" : "encomendas"
                          }`}
                        {group.orders.length > 0 && group.sales.length > 0 && " · "}
                        {group.sales.length > 0 &&
                          `${group.sales.length} ${
                            group.sales.length === 1 ? "venda" : "vendas"
                          }`}
                        {" · "}
                        {formatCurrencyBRL(group.totalCents)}
                      </p>
                    </div>
                    {isToday && <Badge tone="brand">Hoje</Badge>}
                    {isPast && !isToday && <Badge tone="warning">Atrasado</Badge>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
