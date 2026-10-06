"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, PackageSearch, Search, MessageCircle, History, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  listRecentOrders,
  isOrderCompleted,
  buildProductionWhatsAppText,
  markOrderDelivered,
  OrderListItem,
} from "@/lib/firebase/orders";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";
import { orderStatusLabel, orderStatusTone } from "@/lib/utils/order-status";
import { OrderStatus } from "@/types";

const statusFilterOptions: (OrderStatus | "todas")[] = [
  "todas",
  "em_producao",
  "cancelada",
];

export default function EncomendasPage() {
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "todas">("todas");
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
  // Encomendas finalizadas saem da lista principal e ficam no histórico.
  const active = orders?.filter((o) => !isOrderCompleted(o));
  const filtered = active?.filter(
    (o) =>
      o.customerName.toLowerCase().includes(term) &&
      (statusFilter === "todas" || o.status === statusFilter)
  );

  function handleShareProduction() {
    if (!active) return;
    const text = buildProductionWhatsAppText(active);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleMarkDelivered(orderId: string) {
    setDeliveringId(orderId);
    setActionError(null);
    try {
      await markOrderDelivered(orderId);
      setOrders((current) => current?.map((order) => order.id === orderId
        ? { ...order, status: "finalizada" }
        : order) ?? null);
    } catch (err) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "Não foi possível marcar como entregue.");
    } finally {
      setDeliveringId(null);
    }
  }

  return (
    <AppShell title="Encomendas">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row md:flex-1">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <Input
              placeholder="Buscar por cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "todas")}
            className="sm:w-48"
          >
            {statusFilterOptions.map((s) => (
              <option key={s} value={s}>
                {s === "todas" ? "Todos os status" : orderStatusLabel[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleShareProduction} disabled={!active}>
            <MessageCircle className="h-4 w-4" /> Produção
          </Button>
          <Link href="/vendas/nova" className="w-full md:w-auto">
            <Button size="lg" className="w-full md:w-auto">
              <Plus className="h-4 w-4" /> Nova
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-4">
        <Link
          href="/encomendas/historico"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <History className="h-3.5 w-3.5" /> Ver histórico (finalizadas)
        </Link>
      </div>

      {actionError && <p role="alert" className="mb-3 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">{actionError}</p>}

      {orders === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={PackageSearch}
          title="Não foi possível carregar as encomendas"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {orders !== null && !error && filtered?.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title={
            search || statusFilter !== "todas"
              ? "Nenhuma encomenda encontrada"
              : "Nenhuma encomenda em aberto"
          }
          description={
            search || statusFilter !== "todas"
              ? "Tente ajustar a busca ou o filtro de status."
              : "Registre uma nova encomenda, ou confira o histórico das já finalizadas."
          }
          actionLabel={search || statusFilter !== "todas" ? undefined : "+ Nova encomenda"}
          onAction={
            search || statusFilter !== "todas"
              ? undefined
              : () => (window.location.href = "/vendas/nova")
          }
        />
      )}

      {filtered && filtered.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {filtered.map((order) => (
              <li key={order.id}>
                <div className="flex items-center gap-2 px-3 py-3.5 sm:px-4">
                  <Link
                    href={`/encomendas/${order.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 transition-colors hover:bg-surface-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{order.customerName}</p>
                      <p className="text-xs text-ink-muted">
                        Entrega {formatDateBR(order.expectedDate)} · {order.itemsCount}{" "}
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
                  {order.status !== "cancelada" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      loading={deliveringId === order.id}
                      disabled={deliveringId !== null}
                      onClick={() => handleMarkDelivered(order.id)}
                    >
                      <Check className="h-4 w-4" /> Entregue
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
