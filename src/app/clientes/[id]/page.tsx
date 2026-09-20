"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Pencil, Power } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CustomerForm } from "@/features/customers/components/CustomerForm";
import { getCustomer, setCustomerActive } from "@/lib/firebase/customers";
import { getCustomerStats, CustomerStats } from "@/lib/firebase/stats";
import { Customer } from "@/types";
import { formatCurrencyBRL, formatDateBR, formatPhoneBR } from "@/lib/utils/format";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null | undefined>(undefined);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [error, setError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function load() {
    setError(false);
    setCustomer(undefined);
    try {
      const [c, s] = await Promise.all([
        getCustomer(params.id),
        getCustomerStats(params.id),
      ]);
      setCustomer(c);
      setStats(s);
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
    <AppShell title="Cliente">
      <Link
        href="/clientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Clientes
      </Link>

      {customer === undefined && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar este cliente"
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {customer === null && !error && <EmptyState icon={AlertCircle} title="Cliente não encontrado" />}

      {customer && stats && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{customer.name}</CardTitle>
                <p className="mt-0.5 text-xs text-ink-muted">{formatPhoneBR(customer.phone)}</p>
              </div>
              {!customer.active && <Badge tone="neutral">Inativo</Badge>}
            </CardHeader>

            {customer.address && (
              <p className="mb-1 text-sm text-ink-muted">{customer.address}</p>
            )}
            {customer.notes && <p className="text-sm text-ink-muted">{customer.notes}</p>}

            <div className="mt-4 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
                <Power className="h-4 w-4" /> {customer.active ? "Desativar" : "Reativar"}
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-ink-muted">Total comprado</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(stats.totalPurchasedCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Compras</p>
                <p className="font-display text-base font-semibold text-ink">
                  {stats.purchaseCount}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Ticket médio</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(stats.averageTicketCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Pendente</p>
                <p className="font-display text-base font-semibold text-warning-700">
                  {formatCurrencyBRL(stats.pendingCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Última compra</p>
                <p className="font-display text-base font-semibold text-ink">
                  {stats.lastPurchaseAt ? formatDateBR(stats.lastPurchaseAt) : "—"}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Produto mais comprado</p>
                <p className="font-display text-base font-semibold text-ink">
                  {stats.topProductName ?? "—"}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar cliente">
        {customer && (
          <CustomerForm
            customer={customer}
            onSuccess={() => {
              setEditOpen(false);
              load();
            }}
          />
        )}
      </Modal>

      {customer && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={customer.active ? "Desativar cliente" : "Reativar cliente"}
          description={
            customer.active
              ? "O cliente não vai mais aparecer para seleção em novas vendas, mas o histórico é mantido."
              : "O cliente volta a aparecer para seleção em novas vendas."
          }
          confirmLabel={customer.active ? "Desativar" : "Reativar"}
          danger={customer.active}
          onConfirm={async () => {
            await setCustomerActive(customer.id, !customer.active);
            load();
          }}
        />
      )}
    </AppShell>
  );
}
