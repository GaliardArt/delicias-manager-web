"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, FileText, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  getClosedDayWithOrders,
  groupOrdersByAddress,
  SalesDayDoc,
} from "@/lib/firebase/sales-days";
import { Order } from "@/types";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";
import { orderStatusLabel, orderStatusTone } from "@/lib/utils/order-status";
import { buildOrderNoteData, SimpleNoteData } from "@/lib/utils/simple-note";
import { SimpleNoteModal } from "@/features/notes/components/SimpleNoteModal";

export default function DiaDeVendaHistoricoDetailPage() {
  const params = useParams<{ id: string }>();
  const [day, setDay] = useState<SalesDayDoc | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState(false);
  const [noteOrder, setNoteOrder] = useState<Order | null>(null);

  async function load() {
    setError(false);
    setDay(undefined);
    try {
      const data = await getClosedDayWithOrders(params.id);
      if (!data) {
        setDay(null);
      } else {
        setDay(data.day);
        setOrders(data.orders);
      }
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const addressGroups = groupOrdersByAddress(orders);

  return (
    <AppShell title="Dia de Venda">
      <Link
        href="/dias-de-venda/historico"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para o histórico
      </Link>

      {day === undefined && !error && (
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

      {day === null && !error && (
        <EmptyState icon={AlertCircle} title="Dia de Venda não encontrado" />
      )}

      {day && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{formatDateBR(day.date)}</CardTitle>
              <Badge tone="neutral">Encerrado</Badge>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-ink-muted">Pedidos</p>
                <p className="font-display text-base font-semibold text-ink">
                  {day.ordersCount}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Esperado</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(day.expectedCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Recebido</p>
                <p className="font-display text-base font-semibold text-success-700">
                  {formatCurrencyBRL(day.receivedCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Pendente (fiado)</p>
                <p className="font-display text-base font-semibold text-warning-700">
                  {formatCurrencyBRL(day.pendingCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Cancelado</p>
                <p className="font-display text-base font-semibold text-danger-700">
                  {formatCurrencyBRL(day.cancelledCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Não realizado</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(day.notRealizedCents)}
                </p>
              </div>
            </div>
          </Card>

          {day.salesCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vendas do dia</CardTitle>
              </CardHeader>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-ink-muted">Vendas</p>
                  <p className="font-display text-base font-semibold text-ink">
                    {day.salesCount}
                  </p>
                </div>
                <div>
                  <p className="text-ink-muted">Faturamento</p>
                  <p className="font-display text-base font-semibold text-ink">
                    {formatCurrencyBRL(day.salesCents)}
                  </p>
                </div>
                <div>
                  <p className="text-ink-muted">Recebido</p>
                  <p className="font-display text-base font-semibold text-success-700">
                    {formatCurrencyBRL(day.salesReceivedCents)}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Já incluído nos totais combinados acima — mostrado aqui separado
                para você saber de onde veio o valor.
              </p>
            </Card>
          )}

          {orders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Encomendas do dia</CardTitle>
              </CardHeader>
              <ul className="flex flex-col divide-y divide-line">
                {orders.map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{order.customerName}</p>
                      <p className="text-xs text-ink-muted">
                        {order.pendingCents > 0
                          ? `Faltou pagar ${formatCurrencyBRL(order.pendingCents)}`
                          : "Pago"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-medium text-ink">
                        {formatCurrencyBRL(order.totalCents)}
                      </span>
                      <Badge tone={orderStatusTone[order.status]}>
                        {orderStatusLabel[order.status]}
                      </Badge>
                      {order.status !== "cancelada" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setNoteOrder(order)}
                        >
                          <FileText className="h-4 w-4" /> Nota
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {addressGroups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Por endereço</CardTitle>
              </CardHeader>
              <ul className="flex flex-col divide-y divide-line">
                {addressGroups.map((group) => (
                  <li key={group.address} className="py-2.5">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-500" /> {group.address}
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-0.5 pl-5">
                      {group.orders.map((o, i) => (
                        <li key={i} className="text-sm text-ink-muted">
                          {o.customerName} — {o.itemsQuantity}{" "}
                          {o.itemsQuantity === 1 ? "item" : "itens"}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
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
    </AppShell>
  );
}
