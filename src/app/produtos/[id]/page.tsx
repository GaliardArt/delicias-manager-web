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
import { ProductForm } from "@/features/products/components/ProductForm";
import { getProduct, setProductActive } from "@/lib/firebase/products";
import { getProductStats, ProductStats } from "@/lib/firebase/stats";
import { Product } from "@/types";
import { formatCurrencyBRL } from "@/lib/utils/format";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [error, setError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function load() {
    setError(false);
    setProduct(undefined);
    try {
      const [p, s] = await Promise.all([getProduct(params.id), getProductStats(params.id)]);
      setProduct(p);
      setStats(s);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  return (
    <AppShell title="Produto">
      <Link
        href="/produtos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Produtos
      </Link>

      {product === undefined && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar este produto"
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {product === null && !error && <EmptyState icon={AlertCircle} title="Produto não encontrado" />}

      {product && stats && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{product.name}</CardTitle>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {product.category} · {formatCurrencyBRL(product.priceCents)} / {product.unit}
                </p>
              </div>
              {!product.active && <Badge tone="neutral">Inativo</Badge>}
            </CardHeader>

            {product.description && (
              <p className="text-sm text-ink-muted">{product.description}</p>
            )}

            <div className="mt-4 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
                <Power className="h-4 w-4" /> {product.active ? "Desativar" : "Reativar"}
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-ink-muted">Quantidade vendida</p>
                <p className="font-display text-base font-semibold text-ink">
                  {stats.quantitySold}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Faturamento</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(stats.revenueCents)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar produto">
        {product && (
          <ProductForm
            product={product}
            onSuccess={() => {
              setEditOpen(false);
              load();
            }}
          />
        )}
      </Modal>

      {product && (
        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={product.active ? "Desativar produto" : "Reativar produto"}
          description={
            product.active
              ? "O produto não vai mais aparecer para seleção em novas vendas, mas o histórico é mantido."
              : "O produto volta a aparecer para seleção em novas vendas."
          }
          confirmLabel={product.active ? "Desativar" : "Reativar"}
          danger={product.active}
          onConfirm={async () => {
            await setProductActive(product.id, !product.active);
            load();
          }}
        />
      )}
    </AppShell>
  );
}
