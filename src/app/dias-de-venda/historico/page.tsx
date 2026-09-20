"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { listClosedDays, SalesDayDoc } from "@/lib/firebase/sales-days";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";

export default function DiasDeVendaHistoricoPage() {
  const [days, setDays] = useState<SalesDayDoc[] | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    setDays(null);
    try {
      setDays(await listClosedDays());
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="Histórico de Dias de Venda">
      <Link
        href="/dias-de-venda"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Dias de Venda
      </Link>

      {days === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar o histórico"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {days !== null && !error && days.length === 0 && (
        <EmptyState
          icon={History}
          title="Nenhum Dia de Venda encerrado ainda"
          description="Assim que você fechar um dia em 'Dias de Venda', ele aparece aqui."
        />
      )}

      {days && days.length > 0 && (
        <div className="flex flex-col gap-3">
          {days.map((day) => (
            <Link key={day.id} href={`/dias-de-venda/historico/${day.id}`}>
              <Card className="transition-colors hover:bg-surface-muted">
                <p className="font-display text-base font-semibold text-ink">
                  {formatDateBR(day.date)}
                </p>
                <p className="text-xs text-ink-muted">{day.ordersCount} pedidos</p>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
                  <div>
                    <p className="text-ink-muted">Esperado</p>
                    <p className="font-semibold text-ink">
                      {formatCurrencyBRL(day.expectedCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-muted">Recebido</p>
                    <p className="font-semibold text-success-700">
                      {formatCurrencyBRL(day.receivedCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-muted">Pendente</p>
                    <p className="font-semibold text-warning-700">
                      {formatCurrencyBRL(day.pendingCents)}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
