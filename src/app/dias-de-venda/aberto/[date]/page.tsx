"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, FileText, MapPin, ShoppingBag } from "lucide-react";
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
import { Order } from "@/types";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";
import { buildOrderNoteData, SimpleNoteData } from "@/lib/utils/simple-note";
import { SimpleNoteModal } from "@/features/notes/components/SimpleNoteModal";

export default function FecharDiaDeVendaPage() {
  const params = useParams<{ date: string }>();
  const router = useRouter();
  const date = decodeURIComponent(params.date);

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [sales, setSales] = useState<RawSale[]>([]);
  const [error, setError] = useState(false);
  const [noteOrder, setNoteOrder] = useState<Order | null>(null);
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

  const addressGroups = orders ? groupOrdersByAddress(orders) : [];
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
              {orders.length > 0 && <Badge tone="brand">{orders.length} encomendas</Badge>}
            </CardHeader>
            {orders.length > 0 ? (
              <p className="text-sm text-ink-muted">
                Ao encerrar o Dia de Venda, todas as encomendas ativas desta data serão
                marcadas como <strong>Finalizada</strong>, o que significa que foram
                entregues. O pagamento continua separado: o que não foi recebido
                permanece como pendente/fiado e pode ser quitado depois.
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
              {orders.map((order) => (
                <Card key={order.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{order.customerName}</p>
                      <p className="text-xs text-ink-muted">
                        {order.items.map((i) => String(i.quantity) + "x " + i.productName).join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        Total {formatCurrencyBRL(order.totalCents)} · Recebido{" "}
                        {formatCurrencyBRL(order.paidCents)} · Pendente{" "}
                        {formatCurrencyBRL(order.pendingCents)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={closing}
                        onClick={() => setNoteOrder(order)}
                      >
                        <FileText className="h-4 w-4" /> Nota
                      </Button>
                      <Badge tone={order.pendingCents > 0 ? "warning" : "success"}>
                        {order.pendingCents > 0 ? "Pendente" : "Pago"}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {orders.length > 0 && (
            <Button
              size="lg"
              className="w-full"
              loading={closing}
              onClick={() => finishClosing(orders)}
            >
              <ShoppingBag className="h-4 w-4" /> Fechar dia
            </Button>
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

          <SimpleNoteModal
            open={noteOrder !== null}
            onClose={() => setNoteOrder(null)}
            data={
              noteOrder
                ? buildOrderNoteData(noteOrder)
                : ({
                    kindLabel: "Encomenda",
                    referenceId: "",
                    dateLabel: "",
                    customerName: "",
                    items: [],
                    subtotalCents: 0,
                    discountCents: 0,
                    totalCents: 0,
                    paidCents: 0,
                    pendingCents: 0,
                  } satisfies SimpleNoteData)
            }
          />
        </div>
      )}
    </AppShell>
  );
}
