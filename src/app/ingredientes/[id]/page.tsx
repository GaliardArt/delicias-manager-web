"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Pencil, Power, Boxes } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StockAdjustDialog } from "@/components/ui/StockAdjustDialog";
import { IngredienteForm } from "@/features/ingredientes/components/IngredienteForm";
import {
  getIngrediente,
  setIngredienteActive,
  adjustIngredienteStock,
  listAllIngredientes,
} from "@/lib/firebase/ingredientes";
import { listAllInsumos } from "@/lib/firebase/insumos";
import { Ingrediente, Insumo } from "@/types";
import { formatCurrencyBRL } from "@/lib/utils/format";

export default function IngredienteDetailPage() {
  const params = useParams<{ id: string }>();
  const [ingrediente, setIngrediente] = useState<Ingrediente | null | undefined>(undefined);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [allIngredientes, setAllIngredientes] = useState<Ingrediente[]>([]);
  const [error, setError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  async function load() {
    setError(false);
    setIngrediente(undefined);
    try {
      const [ing, ins, all] = await Promise.all([
        getIngrediente(params.id),
        listAllInsumos(),
        listAllIngredientes(),
      ]);
      setIngrediente(ing);
      setInsumos(ins);
      setAllIngredientes(all);
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
    <AppShell title="Ingrediente">
      <Link
        href="/ingredientes"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Ingredientes
      </Link>

      {ingrediente === undefined && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar este ingrediente"
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {ingrediente === null && !error && (
        <EmptyState icon={AlertCircle} title="Ingrediente não encontrado" />
      )}

      {ingrediente && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{ingrediente.name}</CardTitle>
              {!ingrediente.active && <Badge tone="neutral">Inativo</Badge>}
            </CardHeader>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-ink-muted">Rendimento</p>
                <p className="font-display text-base font-semibold text-ink">
                  {ingrediente.yieldQuantity} {ingrediente.yieldUnit}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Custo</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(ingrediente.unitCostCents)}/{ingrediente.yieldUnit}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Estoque</p>
                <p className="font-display text-base font-semibold text-ink">
                  {ingrediente.stockQuantity} {ingrediente.yieldUnit}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStockOpen(true)}>
                <Boxes className="h-4 w-4" /> Ajustar estoque
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
                <Power className="h-4 w-4" /> {ingrediente.active ? "Desativar" : "Reativar"}
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Receita</CardTitle>
            </CardHeader>
            {ingrediente.recipeItems.length === 0 ? (
              <p className="text-sm text-ink-muted">Sem receita cadastrada.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {ingrediente.recipeItems.map((item, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">{item.sourceName}</span>
                    <span className="text-ink-muted">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar ingrediente">
        {ingrediente && (
          <IngredienteForm
            ingrediente={ingrediente}
            insumos={insumos}
            allIngredientes={allIngredientes}
            onSuccess={() => {
              setEditOpen(false);
              load();
            }}
          />
        )}
      </Modal>

      {ingrediente && (
        <>
          <StockAdjustDialog
            open={stockOpen}
            onClose={() => setStockOpen(false)}
            currentStock={ingrediente.stockQuantity}
            unit={ingrediente.yieldUnit}
            onConfirm={async (delta) => {
              await adjustIngredienteStock(ingrediente.id, delta);
              load();
            }}
          />
          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title={ingrediente.active ? "Desativar ingrediente" : "Reativar ingrediente"}
            description={
              ingrediente.active
                ? "O ingrediente não vai mais aparecer para seleção em novas receitas."
                : "O ingrediente volta a aparecer para seleção em novas receitas."
            }
            confirmLabel={ingrediente.active ? "Desativar" : "Reativar"}
            danger={ingrediente.active}
            onConfirm={async () => {
              await setIngredienteActive(ingrediente.id, !ingrediente.active);
              load();
            }}
          />
        </>
      )}
    </AppShell>
  );
}
