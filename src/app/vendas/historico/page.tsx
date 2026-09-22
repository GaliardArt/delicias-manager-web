"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { listHistoricalSales, SaleListItem } from "@/lib/firebase/sales";
import { formatCurrencyBRL, formatDateTimeBR } from "@/lib/utils/format";
import { SaleStatusBadge } from "@/features/sales/components/SaleStatusBadge";

export default function VendasHistoricoPage() {
  const [sales, setSales] = useState<SaleListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setError(false);
    setSales(null);
    try {
      setSales(await listHistoricalSales());
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const term = search.toLowerCase();
  const filtered = sales?.filter((sale) => sale.customerName.toLowerCase().includes(term));

  return (
    <AppShell title="Histórico de vendas">
      <Link
        href="/vendas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Vendas
      </Link>

      <div className="relative mb-4 w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <Input
          placeholder="Buscar por cliente"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {sales === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={History}
          title="Não foi possível carregar o histórico"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {filtered && filtered.length === 0 && !error && (
        <EmptyState
          icon={History}
          title={search ? "Nenhuma venda encontrada" : "Nenhuma venda no histórico"}
          description={
            search
              ? "Tente buscar por outro nome de cliente."
              : "As vendas aparecem aqui quando o Dia de Venda correspondente é encerrado."
          }
        />
      )}

      {filtered && filtered.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {filtered.map((sale) => (
              <li key={sale.id}>
                <Link
                  href={`/vendas/${sale.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{sale.customerName}</p>
                    <p className="text-xs text-ink-muted">
                      {formatDateTimeBR(sale.createdAt)} · {sale.itemsCount}{" "}
                      {sale.itemsCount === 1 ? "item" : "itens"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-ink">
                      {formatCurrencyBRL(sale.totalCents)}
                    </span>
                    <SaleStatusBadge totalCents={sale.totalCents} paidCents={sale.paidCents} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
