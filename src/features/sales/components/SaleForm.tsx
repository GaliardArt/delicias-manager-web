"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle, Percent } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Checkbox } from "@/components/ui/Checkbox";
import { Customer, Ingrediente, Insumo, PaymentMethod, Product, SaleItem } from "@/types";
import { listActiveCustomers } from "@/lib/firebase/customers";
import { listActiveProducts } from "@/lib/firebase/products";
import { listActiveInsumos } from "@/lib/firebase/insumos";
import { listActiveIngredientes } from "@/lib/firebase/ingredientes";
import { createSale } from "@/lib/firebase/sales";
import { resolveProductCost, toInsumosMap, toIngredientesMap } from "@/lib/costing";
import { formatCurrencyBRL } from "@/lib/utils/format";
import { paymentMethodOptions } from "@/lib/utils/payment-method";
import { Users } from "lucide-react";

type DiscountMode = "valor" | "percentual";

export function SaleForm() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [avulso, setAvulso] = useState(false);
  const [avulsoName, setAvulsoName] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);

  const [pendingProductId, setPendingProductId] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [pendingPriceCents, setPendingPriceCents] = useState(0);

  const [discountMode, setDiscountMode] = useState<DiscountMode>("valor");
  const [discountValueCents, setDiscountValueCents] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  const [method, setMethod] = useState<PaymentMethod>("dinheiro");
  const [paidCents, setPaidCents] = useState(0);
  const [paidTouched, setPaidTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listActiveCustomers(),
      listActiveProducts(),
      listActiveInsumos(),
      listActiveIngredientes(),
    ])
      .then(([c, p, ins, ing]) => {
        setCustomers(c);
        setProducts(p);
        setInsumos(ins);
        setIngredientes(ing);
      })
      .catch((err) => {
        console.error(err);
        setLoadError(true);
      });
  }, []);

  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const rawDiscountCents =
    discountMode === "valor"
      ? discountValueCents
      : Math.round(subtotalCents * (discountPercent / 100));
  const discountCents = Math.max(0, Math.round(rawDiscountCents));
  const totalCents = Math.max(0, subtotalCents - discountCents);

  useEffect(() => {
    if (method === "fiado") {
      setPaidCents(0);
    } else if (!paidTouched) {
      setPaidCents(totalCents);
    } else {
      setPaidCents((current) => Math.min(current, totalCents));
    }
  }, [totalCents, method, paidTouched]);

  function handleSelectProduct(productId: string) {
    setPendingProductId(productId);
    const product = products?.find((p) => p.id === productId);
    setPendingPriceCents(product?.priceCents ?? 0);
  }

  function handleAddItem() {
    const product = products?.find((p) => p.id === pendingProductId);
    if (!product || pendingQuantity <= 0) return;

    const unitCostCents = resolveProductCost(
      product.recipeItems,
      toInsumosMap(insumos),
      toIngredientesMap(ingredientes),
      product.yieldQuantity
    );

    const newItem: SaleItem = {
      productId: product.id,
      productName: product.name,
      quantity: pendingQuantity,
      unitPriceCents: pendingPriceCents,
      unitCostCents,
      totalCents: pendingQuantity * pendingPriceCents,
    };
    setItems((prev) => [...prev, newItem]);
    setPendingProductId("");
    setPendingQuantity(1);
    setPendingPriceCents(0);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const pendingCents = totalCents - paidCents;
  const selectedCustomer = customers?.find((c) => c.id === customerId);
  const effectiveCustomerName = avulso ? avulsoName.trim() || "Cliente avulso" : selectedCustomer?.name;

  async function handleSubmit() {
    setFormError(null);

    if (!avulso && !selectedCustomer) {
      setFormError("Selecione um cliente ou marque \"Avulso\".");
      return;
    }
    if (items.length === 0) {
      setFormError("Adicione ao menos um produto à venda.");
      return;
    }
    if (discountCents > subtotalCents) {
      setFormError("O desconto não pode ser maior que o subtotal.");
      return;
    }
    if (paidCents > totalCents) {
      setFormError("O valor pago não pode ser maior que o total.");
      return;
    }

    setSubmitting(true);
    try {
      const saleId = await createSale({
        customerId: avulso ? "" : selectedCustomer!.id,
        customerName: effectiveCustomerName!,
        items,
        discountCents,
        initialPaymentCents: paidCents,
        initialPaymentMethod: method,
      });
      router.push(`/vendas/${saleId}`);
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error
          ? err.message
          : "Não foi possível registrar a venda. Nenhum dado foi alterado."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Não foi possível carregar clientes e produtos"
        description="Verifique sua conexão ou as credenciais do Firebase."
      />
    );
  }

  if (!customers || !products) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Cadastre produtos primeiro"
        description="Ainda não há produtos ativos cadastrados."
        actionLabel="+ Novo produto"
        onAction={() => (window.location.href = "/produtos")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-4">
      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <Checkbox
            id="avulso"
            label="Avulso (para clientes não cadastrados)"
            checked={avulso}
            onChange={(e) => setAvulso(e.target.checked)}
          />
          {avulso ? (
            <Input
              label="Nome (opcional)"
              value={avulsoName}
              onChange={(e) => setAvulsoName(e.target.value)}
              placeholder="Cliente avulso"
            />
          ) : (
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Selecione um cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos</CardTitle>
        </CardHeader>

        {items.length > 0 && (
          <ul className="mb-3 flex flex-col divide-y divide-line">
            {items.map((item, index) => (
              <li key={index} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.productName}</p>
                  <p className="text-xs text-ink-muted">
                    {item.quantity} × {formatCurrencyBRL(item.unitPriceCents)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-ink">
                    {formatCurrencyBRL(item.totalCents)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="text-ink-faint hover:text-danger-500"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <Select
            label="Produto"
            value={pendingProductId}
            onChange={(e) => handleSelectProduct(e.target.value)}
          >
            <option value="">Selecione um produto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input
            label="Qtd."
            type="number"
            min={1}
            value={pendingQuantity}
            onChange={(e) => setPendingQuantity(Number(e.target.value))}
            className="w-full sm:w-20"
          />
          <MoneyInput
            label="Preço un."
            valueCents={pendingPriceCents}
            onValueCentsChange={setPendingPriceCents}
            className="w-full sm:w-28"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddItem}
            disabled={!pendingProductId}
          >
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desconto</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <Select
            label="Tipo de desconto"
            value={discountMode}
            onChange={(e) => setDiscountMode(e.target.value as DiscountMode)}
          >
            <option value="valor">Valor (R$)</option>
            <option value="percentual">Percentual (%)</option>
          </Select>

          {discountMode === "valor" ? (
            <MoneyInput
              label="Desconto"
              valueCents={discountValueCents}
              onValueCentsChange={setDiscountValueCents}
            />
          ) : (
            <div className="relative">
              <Percent className="pointer-events-none absolute right-3.5 top-10 h-4 w-4 text-ink-faint" />
              <Input
                label="Desconto"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value) || 0)}
                className="pr-9"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Subtotal</span>
              <span className="font-semibold text-ink">{formatCurrencyBRL(subtotalCents)}</span>
            </div>
            {discountCents > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-muted">Desconto</span>
                <span className="font-semibold text-danger-700">
                  - {formatCurrencyBRL(Math.min(discountCents, subtotalCents))}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1.5">
              <span className="font-medium text-ink">Total</span>
              <span className="font-display text-base font-semibold text-ink">
                {formatCurrencyBRL(totalCents)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagamento</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Forma de pagamento"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {paymentMethodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <MoneyInput
            label="Valor pago agora"
            valueCents={paidCents}
            onValueCentsChange={(cents) => {
              setPaidTouched(true);
              setPaidCents(cents);
            }}
            disabled={method === "fiado"}
          />
        </div>

        <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-muted">Total</span>
            <span className="font-semibold text-ink">{formatCurrencyBRL(totalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Pago</span>
            <span className="font-semibold text-success-700">
              {formatCurrencyBRL(paidCents)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Pendente</span>
            <span className="font-semibold text-warning-700">
              {formatCurrencyBRL(pendingCents)}
            </span>
          </div>
        </div>
      </Card>

      {formError && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          loading={submitting}
          disabled={items.length === 0 || (!avulso && !customerId)}
        >
          Registrar venda · {formatCurrencyBRL(totalCents)}
        </Button>
      </div>
    </div>
  );
}
