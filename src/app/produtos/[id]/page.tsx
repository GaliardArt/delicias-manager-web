"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Boxes, Copy, Pencil, Power } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StockAdjustDialog } from "@/components/ui/StockAdjustDialog";
import { ProductForm } from "@/features/products/components/ProductForm";
import {
  adjustProductStock,
  createProduct,
  getProduct,
  setProductActive,
} from "@/lib/firebase/products";
import { listAllIngredientesAndInsumos } from "@/lib/firebase/ingredientes";
import { getProductStats, ProductStats } from "@/lib/firebase/stats";
import {
  getProductExtraCost,
  resolveProductCost,
  resolveProductCostPerGram,
  resolveProductTotalWeightGrams,
  toInsumosMap,
  toIngredientesMap,
} from "@/lib/costing";
import { Product, Insumo, Ingrediente } from "@/types";
import { formatCurrencyBRL } from "@/lib/utils/format";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [error, setError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState(false);

  async function load() {
    setError(false);
    setProduct(undefined);
    try {
      const [p, s, ingredientData] = await Promise.all([
        getProduct(params.id),
        getProductStats(params.id),
        listAllIngredientesAndInsumos(),
      ]);
      setProduct(p);
      setStats(s);
      setInsumos(ingredientData.insumos);
      setIngredientes(ingredientData.ingredientes);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleDuplicateProduct() {
    if (!product || duplicating) return;

    setDuplicating(true);
    setDuplicateError(false);
    try {
      const duplicatedId = await createProduct({
        name: `${product.name} (cópia)`,
        category: product.category,
        priceCents: product.priceCents,
        unit: product.unit,
        yieldQuantity: product.yieldQuantity,
        yieldWeightGrams: product.yieldWeightGrams,
        description: product.description ?? "",
        recipeItems: product.recipeItems.map((item) => ({ ...item })),
        extraCostCents: product.extraCostCents ?? 0,
        extraCostMode: product.extraCostMode ?? "unidade",
        extraCostPct: product.extraCostPct ?? 0,
      });
      router.push(`/produtos/${duplicatedId}`);
    } catch (err) {
      console.error(err);
      setDuplicateError(true);
    } finally {
      setDuplicating(false);
    }
  }

  const cost = useMemo(
    () =>
      product
        ? resolveProductCost(
            product.recipeItems,
            toInsumosMap(insumos),
            toIngredientesMap(ingredientes),
            product.yieldQuantity,
            getProductExtraCost(product)
          )
        : 0,
    [product, insumos, ingredientes]
  );
  const extraCost = product ? getProductExtraCost(product) : getProductExtraCost({});
  const hasCostInfo = product
    ? product.recipeItems.length > 0 || extraCost.cents > 0 || extraCost.percentage > 0
    : false;
  const margin = product ? product.priceCents - cost : 0;
  const marginPct = product && product.priceCents > 0 ? (margin / product.priceCents) * 100 : 0;
  const totalWeightGrams = product
    ? resolveProductTotalWeightGrams(product.yieldQuantity, product.yieldWeightGrams)
    : 0;
  const costPerGram =
    product && product.yieldWeightGrams > 0
      ? resolveProductCostPerGram(
          product.recipeItems,
          toInsumosMap(insumos),
          toIngredientesMap(ingredientes),
          product.yieldQuantity,
          product.yieldWeightGrams,
          getProductExtraCost(product)
        )
      : 0;

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
              <p className="mb-3 text-sm text-ink-muted">{product.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-ink-muted">Rendimento</p>
                <p className="font-display text-base font-semibold text-ink">
                  {product.yieldQuantity} {product.unit}
                </p>
                {product.yieldWeightGrams > 0 && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {product.yieldWeightGrams.toLocaleString("pt-BR")} g por unidade
                  </p>
                )}
              </div>
              <div>
                <p className="text-ink-muted">Estoque</p>
                <p
                  className={`font-display text-base font-semibold ${product.stockQuantity < 0 ? "text-danger-500" : "text-ink"}`}
                >
                  {product.stockQuantity}
                </p>
              </div>
              {hasCostInfo && (
                <>
                  <div>
                    <p className="text-ink-muted">Custo</p>
                    <p className="font-display text-base font-semibold text-ink">
                      {formatCurrencyBRL(cost)}
                    </p>
                  </div>
                  {extraCost.percentage > 0 && (
                    <div>
                      <p className="text-ink-muted">Custo adicional</p>
                      <p className="font-display text-base font-semibold text-ink">
                        {extraCost.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
                      </p>
                    </div>
                  )}
                  {product.yieldWeightGrams > 0 && (
                    <>
                      <div>
                        <p className="text-ink-muted">Custo / g</p>
                        <p className="font-display text-base font-semibold text-ink">
                          {formatCurrencyBRL(costPerGram)}
                        </p>
                      </div>
                      <div>
                        <p className="text-ink-muted">Peso total da receita</p>
                        <p className="font-display text-base font-semibold text-ink">
                          {totalWeightGrams.toLocaleString("pt-BR")} g
                        </p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-ink-muted">Margem</p>
                    <p className="font-display text-base font-semibold text-success-700">
                      {formatCurrencyBRL(margin)} ({marginPct.toFixed(0)}%)
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Editar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={duplicating}
                onClick={handleDuplicateProduct}
              >
                <Copy className="h-4 w-4" /> Duplicar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStockOpen(true)}>
                <Boxes className="h-4 w-4" /> Ajustar estoque
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(true)}>
                <Power className="h-4 w-4" /> {product.active ? "Desativar" : "Reativar"}
              </Button>
            </div>
            {duplicateError && (
              <p className="mt-2 text-sm text-danger-700">
                Não foi possível duplicar o produto. Tente novamente.
              </p>
            )}
          </Card>

          {product.recipeItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Receita</CardTitle>
              </CardHeader>
              <ul className="flex flex-col divide-y divide-line">
                {product.recipeItems.map((item, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">{item.sourceName}</span>
                    <span className="text-ink-muted">
                      {item.quantity} {item.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Histórico de vendas</CardTitle>
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

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar produto"
        maxWidthClassName="max-w-2xl"
        fixedContent
      >
        {product && (
          <ProductForm
            product={product}
            insumos={insumos}
            ingredientes={ingredientes}
            onSuccess={(savedProduct) => {
              setEditOpen(false);
              setProduct(savedProduct);
            }}
          />
        )}
      </Modal>

      {product && (
        <>
          <StockAdjustDialog
            open={stockOpen}
            onClose={() => setStockOpen(false)}
            currentStock={product.stockQuantity}
            unit={product.unit}
            onConfirm={async (delta) => {
              await adjustProductStock(product.id, delta);
              load();
            }}
          />
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
        </>
      )}
    </AppShell>
  );
}
