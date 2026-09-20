"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, MapPin, ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getActiveOrdersForDate,
  getSalesForDate,
  groupOrdersByAddress,
  closeDay,
} from "@/lib/firebase/sales-days";
import { summarizeSales, RawSale } from "@/lib/firebase/reports";
import { addOrderPayment } from "@/lib/firebase/orders";
import { Order } from "@/types";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";

type Decision = "pago" | "fiado";

export default function FecharDiaDeVendaPage() {
  const params = useParams<{ date: string }>();
  const router = useRouter();
  const date = decodeURIComponent(params.date);

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [sales, setSales] = useState<RawSale[]>([]);
  const [error, setError] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  async function load() {
    setError(false);
    setOrders(null);
    try {
      const [ordersData, salesData] = await Promise.all([
        getActiveOrdersForDate(date),
        getSalesForDate(date),
      ]);
      setOrders(ordersData);
      setSales(salesData);
      // Encomendas já totalmente pagas antes de abrir essa tela entram
      // pré-marcadas como "Pago" — só falta decidir o que realmente está em
      // aberto.
      const initialDecisions: Record<string, Decision> = {};
      for (const order of ordersData) {
        if (order.pendingCents <= 0) initialDecisions[order.id] = "pago";
      }
      setDecisions(initialDecisions);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function finishClosing(finalOrders: Order[]) {
    setClosing(true);
    try {
      const dayId = await closeDay(date, finalOrders, sales);
      router.push(`/dias-de-venda/historico/${dayId}`);
    } catch (err) {
      console.error(err);
      setError(true);
      setClosing(false);
    }
  }

  async function handleDecision(order: Order, decision: Decision) {
    if (!orders) return;
    setPendingOrderId(order.id);

    let updatedOrder = order;
    try {
      if (decision === "pago" && order.pendingCents > 0) {
        await addOrderPayment(order.id, order.pendingCents, "dinheiro");
        updatedOrder = { ...order, paidCents: order.totalCents, pendingCents: 0 };
      }

      const updatedOrders = orders.map((o) => (o.id === order.id ? updatedOrder : o));
      const newDecisions = { ...decisions, [order.id]: decision };

      setOrders(updatedOrders);
      setDecisions(newDecisions);
      setPendingOrderId(null);

      // Só fecha sozinho quando existe algo pra decidir e tudo já foi marcado —
      // um dia sem nenhuma encomenda não fecha na hora sem querer.
      const allDecided =
        updatedOrders.length > 0 && updatedOrders.every((o) => newDecisions[o.id]);
      if (allDecided) {
        await finishClosing(updatedOrders);
      }
    } catch (err) {
      console.error(err);
      setPendingOrderId(null);
      setError(true);
    }
  }

  const addressGroups = orders ? groupOrdersByAddress(orders) : [];
  const decidedCount = orders ? orders.filter((o) => decisions[o.id]).length : 0;
  const salesSummary = summarizeSales(sales);
  const nothingToShow = orders !== null && orders.length === 0 && sales.length === 0;

  return (
    <AppShell title="Fechar Dia de Venda">
      <Link
        href="/dias-de-venda"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Dias de Venda
      </Link>

      {orders === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar este Dia de Venda"
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {nothingToShow && !error && (
        <EmptyState
          icon={AlertCircle}
          title="Nada em aberto nessa data"
          description="Talvez esse dia já tenha sido encerrado."
        />
      )}

      {orders && !nothingToShow && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{formatDateBR(date)}</CardTitle>
              {orders.length > 0 && (
                <Badge tone={decidedCount === orders.length ? "success" : "brand"}>
                  {decidedCount} de {orders.length} confirmadas
                </Badge>
              )}
            </CardHeader>
            {orders.length > 0 ? (
              <p className="text-sm text-ink-muted">
                Marque cada encomenda como <strong>Pago</strong> (registra o pagamento
                do valor pendente agora) ou <strong>Falta pagar</strong> (fica como
                fiado). Quando todas estiverem marcadas, o dia se encerra sozinho.
              </p>
            ) : (
              <p className="text-sm text-ink-muted">
                Não há encomendas para essa data — só vendas avulsas. Feche o dia
                quando quiser.
              </p>
            )}
          </Card>

          {sales.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vendas do dia</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-ink-muted">Vendas</p>
                  <p className="font-display text-base font-semibold text-ink">
                    {salesSummary.quantidadeVendas}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Faturamento</p>
                  <p className="font-display text-base font-semibold text-ink">
                    {formatCurrencyBRL(salesSummary.faturamentoCents)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Recebido</p>
                  <p className="font-display text-base font-semibold text-success-700">
                    {formatCurrencyBRL(salesSummary.recebidoCents)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-muted">Pendente</p>
                  <p className="font-display text-base font-semibold text-warning-700">
                    {formatCurrencyBRL(salesSummary.pendenteCents)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Essas vendas já têm o pagamento registrado normalmente em Vendas —
                aqui só entram somadas no valor do dia.
              </p>
            </Card>
          )}

          {addressGroups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Por endereço</CardTitle>
              </CardHeader>
              <ul className="flex flex-col divide-y divide-line">
                {addressGroups.map((group) => (
                  <li key={group.address} className="py-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-500" /> {group.address}
                    </p>
                    <p className="pl-5 text-xs text-ink-muted">
                      {group.orders.map((o) => o.customerName).join(", ")} — {group.totalQuantity}{" "}
                      {group.totalQuantity === 1 ? "item" : "itens"}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {orders.length > 0 && (
            <div className="flex flex-col gap-3">
              {orders.map((order) => {
                const decision = decisions[order.id];
                const isBusy = pendingOrderId === order.id || closing;
                return (
                  <Card key={order.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {order.items.map((i) => `${i.quantity}x ${i.productName}`).join(", ")}
                        </p>
                        <p className="mt-1 text-xs text-ink-muted">
                          Total {formatCurrencyBRL(order.totalCents)} · Pendente{" "}
                          {formatCurrencyBRL(order.pendingCents)}
                        </p>
                      </div>

                      {decision ? (
                        <Badge tone={decision === "pago" ? "success" : "warning"}>
                          <Check className="mr-1 h-3 w-3" />
                          {decision === "pago" ? "Pago" : "Falta pagar"}
                        </Badge>
                      ) : (
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={isBusy}
                            onClick={() => handleDecision(order, "fiado")}
                          >
                            Falta pagar
                          </Button>
                          <Button
                            size="sm"
                            loading={pendingOrderId === order.id}
                            disabled={isBusy}
                            onClick={() => handleDecision(order, "pago")}
                          >
                            Pago
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {orders.length === 0 && sales.length > 0 && (
            <Button
              size="lg"
              className="w-full"
              loading={closing}
              onClick={() => finishClosing([])}
            >
              <ShoppingBag className="h-4 w-4" /> Fechar dia
            </Button>
          )}

          {closing && (
            <p className="text-center text-sm text-ink-muted">Encerrando o dia...</p>
          )}
        </div>
      )}
    </AppShell>
  );
}
