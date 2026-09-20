"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, MapPin } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  getSalesDayWithOrders,
  summarizeOrders,
  groupOrdersByAddress,
  closeSalesDay,
  SalesDayDoc,
} from "@/lib/firebase/sales-days";
import { Order } from "@/types";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";

export default function SalesDayDetailPage() {
  const params = useParams<{ id: string }>();
  const [day, setDay] = useState<SalesDayDoc | null | undefined>(undefined);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function load() {
    setError(false);
    setDay(undefined);
    try {
      const data = await getSalesDayWithOrders(params.id);
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

  const liveSummary = summarizeOrders(orders);
  const summary = day?.closed
    ? {
        ordersCount: day.ordersCount,
        expectedCents: day.expectedCents,
        receivedCents: day.receivedCents,
        pendingCents: day.pendingCents,
        fiadoCents: liveSummary.fiadoCents,
        cancelledCount: liveSummary.cancelledCount,
        cancelledCents: day.cancelledCents,
        notRealizedCents: day.notRealizedCents,
      }
    : liveSummary;
  const addressGroups = groupOrdersByAddress(orders);

  return (
    <AppShell title="Dia de Venda">
      <Link
        href="/dias-de-venda"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Dias de Venda
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
              <Badge tone={day.closed ? "neutral" : "success"}>
                {day.closed ? "Encerrado" : "Aberto"}
              </Badge>
            </CardHeader>

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-ink-muted">Pedidos</p>
                <p className="font-display text-base font-semibold text-ink">
                  {summary.ordersCount}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Esperado</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(summary.expectedCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Recebido</p>
                <p className="font-display text-base font-semibold text-success-700">
                  {formatCurrencyBRL(summary.receivedCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Pendente</p>
                <p className="font-display text-base font-semibold text-warning-700">
                  {formatCurrencyBRL(summary.pendingCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Fiado</p>
                <p className="font-display text-base font-semibold text-warning-700">
                  {formatCurrencyBRL(summary.fiadoCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Cancelados</p>
                <p className="font-display text-base font-semibold text-danger-700">
                  {summary.cancelledCount} · {formatCurrencyBRL(summary.cancelledCents)}
                </p>
              </div>
            </div>

            {!day.closed && (
              <Button className="mt-4 w-full sm:w-auto" onClick={() => setConfirmOpen(true)}>
                Encerrar Dia de Venda
              </Button>
            )}
            {day.closed && (
              <p className="mt-4 text-sm text-ink-muted">
                Não realizado (não entregue até o fechamento): {" "}
                <span className="font-semibold text-ink">
                  {formatCurrencyBRL(day.notRealizedCents)}
                </span>
              </p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Por endereço</CardTitle>
            </CardHeader>
            {addressGroups.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum pedido vinculado ainda.</p>
            ) : (
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
                    <p className="mt-1 pl-5 text-xs font-medium text-ink-muted">
                      Total: {group.totalQuantity} {group.totalQuantity === 1 ? "item" : "itens"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {day && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Encerrar Dia de Venda"
          description="Isso grava um resumo fechado dos valores esperado, recebido, pendente, cancelado e não realizado. Os pedidos continuam editáveis normalmente."
          confirmLabel="Encerrar"
          onConfirm={async () => {
            await closeSalesDay(day.id, liveSummary);
            load();
          }}
        />
      )}
    </AppShell>
  );
}
