"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, FileText, MapPin, StickyNote, Trash2, XCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AddOrderPaymentForm } from "@/features/orders/components/AddOrderPaymentForm";
import { cancelOrder, deleteOrder, getOrderWithPayments } from "@/lib/firebase/orders";
import { Order } from "@/types";
import { formatCurrencyBRL, formatDateBR, formatDateTimeBR } from "@/lib/utils/format";
import { orderStatusLabel, orderStatusTone } from "@/lib/utils/order-status";
import { buildOrderNoteData } from "@/lib/utils/simple-note";
import { SimpleNoteModal } from "@/features/notes/components/SimpleNoteModal";
import { paymentMethodLabel } from "@/lib/utils/payment-method";
import { Badge } from "@/components/ui/Badge";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  async function load() {
    setError(false);
    setOrder(undefined);
    try {
      setOrder(await getOrderWithPayments(params.id));
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  return (
    <AppShell title="Detalhe da encomenda">
      <Link
        href="/encomendas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Encomendas
      </Link>

      {order === undefined && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar esta encomenda"
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {order === null && !error && (
        <EmptyState icon={AlertCircle} title="Encomenda não encontrada" />
      )}

      {order && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{order.customerName}</CardTitle>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Entrega prevista para {formatDateBR(order.expectedDate)}
                </p>
              </div>
              <Badge tone={orderStatusTone[order.status]}>{orderStatusLabel[order.status]}</Badge>
            </CardHeader>

            {(order.deliveryAddress || order.notes) && (
              <div className="mb-3 flex flex-col gap-1.5 text-sm text-ink-muted">
                {order.deliveryAddress && (
                  <p className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.deliveryAddress}
                  </p>
                )}
                {order.notes && (
                  <p className="flex items-start gap-1.5">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.notes}
                  </p>
                )}
              </div>
            )}

            <ul className="mb-3 flex flex-col divide-y divide-line">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-ink">{item.productName}</p>
                    <p className="text-xs text-ink-muted">
                      {item.quantity} × {formatCurrencyBRL(item.unitPriceCents)}
                    </p>
                  </div>
                  <span className="font-semibold text-ink">
                    {formatCurrencyBRL(item.totalCents)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Total</span>
                <span className="font-semibold text-ink">
                  {formatCurrencyBRL(order.totalCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Pago</span>
                <span className="font-semibold text-success-700">
                  {formatCurrencyBRL(order.paidCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Pendente</span>
                <span className="font-semibold text-warning-700">
                  {formatCurrencyBRL(order.pendingCents)}
                </span>
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" size="sm" onClick={() => setNoteOpen(true)}>
              <FileText className="h-4 w-4" /> Nota simples
            </Button>
            {order.status !== "finalizada" && order.status !== "cancelada" && (
              <Button variant="danger" size="sm" onClick={() => setCancelConfirmOpen(true)}>
                <XCircle className="h-4 w-4" /> Cancelar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" /> Deletar encomenda
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Status da encomenda</CardTitle>
            </CardHeader>
            <p className="text-sm text-ink-muted">
              {order.status === "finalizada"
                ? "Finalizada = entregue. O pagamento é controlado separadamente."
                : order.status === "cancelada"
                  ? "Cancelada — não realizada."
                  : "Em produção — será finalizada quando o Dia de Venda for encerrado."}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagamentos</CardTitle>
            </CardHeader>
            {order.payments.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum pagamento registrado ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {order.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium text-ink">{paymentMethodLabel[payment.method]}</p>
                      <p className="text-xs text-ink-muted">{formatDateTimeBR(payment.paidAt)}</p>
                    </div>
                    <span className="font-semibold text-success-700">
                      {formatCurrencyBRL(payment.amountCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {order.pendingCents > 0 && order.status !== "cancelada" && (
            <Card>
              <CardHeader>
                <CardTitle>Registrar pagamento</CardTitle>
              </CardHeader>
              <AddOrderPaymentForm
                orderId={order.id}
                maxCents={order.pendingCents}
                onSuccess={load}
              />
            </Card>
          )}
        </div>
      )}

      {order && (
        <SimpleNoteModal
          open={noteOpen}
          onClose={() => setNoteOpen(false)}
          data={buildOrderNoteData(order)}
        />
      )}

      {order && (
        <ConfirmDialog
          open={cancelConfirmOpen}
          onClose={() => setCancelConfirmOpen(false)}
          title="Cancelar encomenda"
          description={"A encomenda de " + order.customerName + " será marcada como cancelada e deixará de representar uma entrega realizada."}
          confirmLabel="Cancelar encomenda"
          danger
          onConfirm={async () => {
            await cancelOrder(order.id);
            await load();
          }}
        />
      )}

      {order && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title="Deletar encomenda"
          description={`Essa ação é permanente e não pode ser desfeita. A encomenda de ${order.customerName} no valor de ${formatCurrencyBRL(
            order.totalCents
          )} será removida do sistema.`}
          confirmLabel="Deletar definitivamente"
          danger
          onConfirm={async () => {
            await deleteOrder(order.id);
            router.push("/encomendas");
          }}
        />
      )}
    </AppShell>
  );
}
