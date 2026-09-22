"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Pencil, Power, Boxes, ShoppingCart, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StockAdjustDialog } from "@/components/ui/StockAdjustDialog";
import { InsumoForm } from "@/features/insumos/components/InsumoForm";
import { RegisterPurchaseForm } from "@/features/insumos/components/RegisterPurchaseForm";
import { getInsumo, setInsumoActive, deleteInsumo, adjustInsumoStock } from "@/lib/firebase/insumos";
import { Insumo } from "@/types";
import { formatCurrencyBRL } from "@/lib/utils/format";

export default function InsumoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [insumo, setInsumo] = useState<Insumo | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  async function load() {
    setError(false);
    setInsumo(undefined);
    try {
      setInsumo(await getInsumo(params.id));
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
    <AppShell title="Insumo">
      <Link
        href="/insumos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Insumos
      </Link>

      {insumo === undefined && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar este insumo"
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {insumo === null && !error && <EmptyState icon={AlertCircle} title="Insumo não encontrado" />}

      {insumo && (
        <Card>
          <CardHeader>
            <CardTitle>{insumo.name}</CardTitle>
            {!insumo.active && <Badge tone="neutral">Inativo</Badge>}
          </CardHeader>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-ink-muted">Custo</p>
              <p className="font-display text-base font-semibold text-ink">
                {formatCurrencyBRL(insumo.unitCostCents)}/{insumo.unit}
              </p>
            </div>
            <div>
              <p className="text-ink-muted">Último lote</p>
              <p className="font-display text-base font-semibold text-ink">
                {formatCurrencyBRL(insumo.purchasePriceCents)} · {insumo.purchaseQuantity}{" "}
                {insumo.unit}
              </p>
            </div>
            <div>
              <p className="text-ink-muted">Estoque</p>
              <p className="font-display text-base font-semibold text-ink">
                {insumo.stockQuantity} {insumo.unit}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setPurchaseOpen(true)}>
              <ShoppingCart className="h-4 w-4" /> Registrar compra
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStockOpen(true)}>
              <Boxes className="h-4 w-4" /> Ajustar estoque
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
              <Power className="h-4 w-4" /> {insumo.active ? "Desativar" : "Reativar"}
            </Button>
              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" /> Deletar
              </Button>
          </div>
        </Card>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar insumo">
        {insumo && <InsumoForm insumo={insumo} onSuccess={() => { setEditOpen(false); load(); }} />}
      </Modal>

      <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title="Registrar compra">
        {insumo && (
          <RegisterPurchaseForm
            insumo={insumo}
            onSuccess={() => {
              setPurchaseOpen(false);
              load();
            }}
          />
        )}
      </Modal>

      {insumo && (
        <>
          <StockAdjustDialog
            open={stockOpen}
            onClose={() => setStockOpen(false)}
            currentStock={insumo.stockQuantity}
            unit={insumo.unit}
            onConfirm={async (delta) => {
              await adjustInsumoStock(insumo.id, delta);
              load();
            }}
          />
          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title={insumo.active ? "Desativar insumo" : "Reativar insumo"}
            description={
              insumo.active
                ? "O insumo não vai mais aparecer para seleção em novas receitas."
                : "O insumo volta a aparecer para seleção em novas receitas."
            }
            confirmLabel={insumo.active ? "Desativar" : "Reativar"}
            danger={insumo.active}
            onConfirm={async () => {
              await setInsumoActive(insumo.id, !insumo.active);
              load();
            }}
          />
          <ConfirmDialog
            open={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
            title="Deletar insumo"
            description={
              <>Essa ação é permanente e não pode ser desfeita. O insumo <strong>{insumo.name}</strong> será removido do sistema. Se ele estiver sendo usado em históricos ou receitas, essas referências não serão reconstruídas.</>
            }
            confirmLabel="Deletar definitivamente"
            danger
            onConfirm={async () => {
              await deleteInsumo(insumo.id);
              router.push("/insumos");
            }}
          />
        </>
      )}
    </AppShell>
  );
}
