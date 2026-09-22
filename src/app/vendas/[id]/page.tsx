"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { SaleStatusBadge } from "@/features/sales/components/SaleStatusBadge";
import { AddPaymentForm } from "@/features/sales/components/AddPaymentForm";
import { deleteSale, getSaleWithPayments } from "@/lib/firebase/sales";
import { Sale } from "@/types";
import { formatCurrencyBRL, formatDateTimeBR } from "@/lib/utils/format";
import { paymentMethodLabel } from "@/lib/utils/payment-method";

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<Sale | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  async function load() {
    setError(false);
    setSale(undefined);
    try {
      const data = await getSaleWithPayments(params.id);
      setSale(data);
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
    <AppShell title="Detalhe da venda">
      <Link
        href="/vendas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Vendas
      </Link>

      {sale === undefined && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar esta venda"
          description="Verifique sua conexão e tente novamente."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {sale === null && !error && (
        <EmptyState icon={AlertCircle} title="Venda não encontrada" />
      )}

      {sale && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{sale.customerName}</CardTitle>
                <p className="mt-0.5 text-xs text-ink-muted">{formatDateTimeBR(sale.createdAt)}</p>
              </div>
              <SaleStatusBadge totalCents={sale.totalCents} paidCents={sale.paidCents} />
            </CardHeader>

            <ul className="mb-3 flex flex-col divide-y divide-line">
              {sale.items.map((item, i) => (
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
                  {formatCurrencyBRL(sale.totalCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Pago</span>
                <span className="font-semibold text-success-700">
                  {formatCurrencyBRL(sale.paidCents)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Pendente</span>
                <span className="font-semibold text-warning-700">
                  {formatCurrencyBRL(sale.pendingCents)}
                </span>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
              <Trash2 className="h-4 w-4" /> Deletar venda
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pagamentos</CardTitle>
            </CardHeader>
            {sale.payments.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhum pagamento registrado ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {sale.payments.map((payment) => (
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

          {sale.pendingCents > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Registrar pagamento</CardTitle>
              </CardHeader>
              <AddPaymentForm saleId={sale.id} maxCents={sale.pendingCents} onSuccess={load} />
            </Card>
          )}
        </div>
      )}

      {sale && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          title="Deletar venda"
          description={`Essa ação é permanente e não pode ser desfeita. A venda de ${sale.customerName} no valor de ${formatCurrencyBRL(
            sale.totalCents
          )} será removida do sistema.`}
          confirmLabel="Deletar definitivamente"
          danger
          onConfirm={async () => {
            await deleteSale(sale.id);
            router.push("/vendas");
          }}
        />
      )}
    </AppShell>
  );
}
