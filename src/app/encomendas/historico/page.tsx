"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { listRecentOrders, isOrderCompleted, OrderListItem } from "@/lib/firebase/orders";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";
import { orderStatusLabel, orderStatusTone } from "@/lib/utils/order-status";

export default function EncomendasHistoricoPage() {
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setError(false);
    setOrders(null);
    try {
      setOrders(await listRecentOrders());
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const term = search.toLowerCase();
  const completed = orders
    ?.filter((o) => isOrderCompleted(o))
    .filter((o) => o.customerName.toLowerCase().includes(term))
    .sort((a, b) => b.expectedDate.localeCompare(a.expectedDate));

  return (
    <AppShell title="Histórico de encomendas">
      <Link
        href="/encomendas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Encomendas
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

      {orders === null && !error && (
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

      {completed && completed.length === 0 && !error && (
        <EmptyState
          icon={History}
          title="Nenhuma encomenda concluída ainda"
          description="Encomendas aparecem aqui automaticamente quando ficam pagas e marcadas como entregues."
        />
      )}

      {completed && completed.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {completed.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/encomendas/${order.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{order.customerName}</p>
                    <p className="text-xs text-ink-muted">
                      Entregue em {formatDateBR(order.expectedDate)} · {order.itemsCount}{" "}
                      {order.itemsCount === 1 ? "item" : "itens"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-ink">
                      {formatCurrencyBRL(order.totalCents)}
                    </span>
                    <Badge tone={orderStatusTone[order.status]}>
                      {orderStatusLabel[order.status]}
                    </Badge>
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
