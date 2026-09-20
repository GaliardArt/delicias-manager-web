"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CreateSalesDayForm } from "@/features/sales-days/components/CreateSalesDayForm";
import { listSalesDays, SalesDayDoc } from "@/lib/firebase/sales-days";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";

export default function DiasDeVendaPage() {
  const router = useRouter();
  const [days, setDays] = useState<SalesDayDoc[] | null>(null);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setError(false);
    setDays(null);
    try {
      setDays(await listSalesDays());
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AppShell title="Dias de Venda">
      <div className="mb-4 flex justify-end">
        <Button size="lg" className="w-full md:w-auto" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Novo Dia de Venda
        </Button>
      </div>

      {days === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={CalendarDays}
          title="Não foi possível carregar os Dias de Venda"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {days !== null && !error && days.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum Dia de Venda criado ainda"
          description="Crie um Dia de Venda para organizar pedidos, entregas e valores de uma data específica."
          actionLabel="+ Novo Dia de Venda"
          onAction={() => setModalOpen(true)}
        />
      )}

      {days && days.length > 0 && (
        <div className="flex flex-col gap-3">
          {days.map((day) => (
            <Link key={day.id} href={`/dias-de-venda/${day.id}`}>
              <Card className="transition-colors hover:bg-surface-muted">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-base font-semibold text-ink">
                      {formatDateBR(day.date)}
                    </p>
                    <p className="text-xs text-ink-muted">{day.ordersCount} pedidos</p>
                  </div>
                  <Badge tone={day.closed ? "neutral" : "success"}>
                    {day.closed ? "Encerrado" : "Aberto"}
                  </Badge>
                </div>
                {day.closed && (
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
                    <div>
                      <p className="text-ink-muted">Esperado</p>
                      <p className="font-semibold text-ink">
                        {formatCurrencyBRL(day.expectedCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-muted">Recebido</p>
                      <p className="font-semibold text-success-700">
                        {formatCurrencyBRL(day.receivedCents)}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-muted">Pendente</p>
                      <p className="font-semibold text-warning-700">
                        {formatCurrencyBRL(day.pendingCents)}
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Dia de Venda">
        <CreateSalesDayForm
          onSuccess={(id) => {
            setModalOpen(false);
            router.push(`/dias-de-venda/${id}`);
          }}
        />
      </Modal>
    </AppShell>
  );
}
