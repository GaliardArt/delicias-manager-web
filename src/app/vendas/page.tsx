"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ShoppingBag, Search, History, MessageCircle, Check } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SaleStatusBadge } from "@/features/sales/components/SaleStatusBadge";
import { listRecentSales, SaleListItem } from "@/lib/firebase/sales";
import { listRecentOrders, isOrderCompleted, OrderListItem, buildProductionWhatsAppText, markOrderDelivered } from "@/lib/firebase/orders";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "@/lib/utils/format";
import { Badge } from "@/components/ui/Badge";
import { orderStatusLabel, orderStatusTone } from "@/lib/utils/order-status";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function VendasPage() {
  const { profile, loading: profileLoading } = useUserProfile();
  const canViewSales = profile?.role === "admin" || profile?.permissions.vendas?.view === true;
  const canViewOrders = profile?.role === "admin" || profile?.permissions.encomendas?.view === true;
  const [sales, setSales] = useState<SaleListItem[] | null>(null);
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [salesError, setSalesError] = useState(false);
  const [ordersError, setOrdersError] = useState(false);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [orderActionError, setOrderActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setSalesError(false);
    setOrdersError(false);
    setSales(null);
    setOrders(null);
    try {
      const [salesResult, ordersResult] = await Promise.allSettled([
        canViewSales ? listRecentSales() : Promise.resolve([]),
        canViewOrders ? listRecentOrders() : Promise.resolve([]),
      ]);
      if (salesResult.status === "fulfilled") setSales(salesResult.value);
      else {
        console.error(salesResult.reason);
        setSalesError(true);
      }
      if (ordersResult.status === "fulfilled") setOrders(ordersResult.value);
      else {
        console.error(ordersResult.reason);
        setOrdersError(true);
      }
    } catch (err) {
      console.error(err);
      if (canViewSales) setSalesError(true);
      if (canViewOrders) setOrdersError(true);
    }
  }, [canViewSales, canViewOrders]);

  useEffect(() => {
    if (!profileLoading) load();
  }, [profileLoading, load]);

  const filtered = sales?.filter((s) =>
    s.customerName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredOrders = orders?.filter((order) =>
    !isOrderCompleted(order) && order.customerName.toLowerCase().includes(search.toLowerCase())
  );
  function shareProductionList() {
    const active = orders?.filter((order) => !isOrderCompleted(order)) ?? [];
    const text = buildProductionWhatsAppText(active);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function handleMarkDelivered(orderId: string) {
    setDeliveringId(orderId);
    setOrderActionError(null);
    try {
      await markOrderDelivered(orderId);
      setOrders((current) => current?.map((order) => order.id === orderId
        ? { ...order, status: "finalizada" }
        : order) ?? null);
    } catch (err) {
      console.error(err);
      setOrderActionError(err instanceof Error ? err.message : "Não foi possível marcar como entregue.");
    } finally {
      setDeliveringId(null);
    }
  }

  return (
    <AppShell title={canViewOrders && canViewSales ? "Vendas e encomendas" : canViewOrders ? "Encomendas" : "Vendas"}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Buscar por cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Link href="/vendas/nova" className="w-full md:w-auto">
          <Button size="lg" className="w-full md:w-auto">
            <Plus className="h-4 w-4" /> Nova venda ou encomenda
          </Button>
        </Link>
      </div>

      {orderActionError && <p role="alert" className="mb-3 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">{orderActionError}</p>}

      <div className="mb-4">
        <Link
          href="/vendas/historico"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          <History className="h-3.5 w-3.5" /> Ver histórico de vendas
        </Link>
      </div>

      {!profileLoading && canViewSales && sales === null && !salesError && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {canViewSales && salesError && (
        <EmptyState
          icon={ShoppingBag}
          title="Não foi possível carregar os registros"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {canViewSales && sales !== null && !salesError && filtered?.length === 0 && (
        <EmptyState
          icon={ShoppingBag}
          title={search ? "Nenhuma venda encontrada" : "Nenhuma venda registrada ainda"}
          description={
            search
              ? "Tente buscar por outro nome de cliente."
              : "Registre a primeira venda para começar a acompanhar o faturamento."
          }
          actionLabel={search ? undefined : "+ Nova venda"}
          onAction={search ? undefined : () => (window.location.href = "/vendas/nova")}
        />
      )}

      {canViewSales && filtered && filtered.length > 0 && (
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

      {canViewOrders && <section id="encomendas" className="mt-6 scroll-mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-ink">Encomendas em andamento</h2>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={shareProductionList} disabled={!orders?.length} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-50">
              <MessageCircle className="h-3.5 w-3.5" /> Produção
            </button>
            <Link href="/encomendas/historico" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
              <History className="h-3.5 w-3.5" /> Histórico
            </Link>
          </div>
        </div>
        {orders === null && !ordersError && (
          <div className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
        )}
        {ordersError && <EmptyState icon={ShoppingBag} title="Não foi possível carregar as encomendas" description="Verifique sua conexão ou tente novamente." actionLabel="Tentar novamente" onAction={load} />}
        {!ordersError && filteredOrders && filteredOrders.length > 0 ? (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {filteredOrders.map((order) => (
                <li key={order.id} className="flex items-center gap-2 px-3 py-3.5 sm:px-4">
                  <Link
                    href={`/encomendas/${order.id}`}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 transition-colors hover:bg-surface-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{order.customerName}</p>
                      <p className="text-xs text-ink-muted">
                        Encomenda · entrega {formatDateBR(order.expectedDate)} · {order.itemsCount} {order.itemsCount === 1 ? "item" : "itens"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-ink">{formatCurrencyBRL(order.totalCents)}</span>
                      <Badge tone={orderStatusTone[order.status]}>{orderStatusLabel[order.status]}</Badge>
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
                </li>
              ))}
            </ul>
          </Card>
        ) : orders !== null && !ordersError ? (
          <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-muted">
            {search ? "Nenhuma encomenda corresponde à busca." : "Nenhuma encomenda em andamento."}
          </div>
        ) : null}
      </section>}
    </AppShell>
  );
}
