"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Customer, PaymentMethod, Product, SaleItem } from "@/types";
import { listActiveCustomers } from "@/lib/firebase/customers";
import { listActiveProducts } from "@/lib/firebase/products";
import { createSale } from "@/lib/firebase/sales";
import { formatCurrencyBRL } from "@/lib/utils/format";
import { paymentMethodOptions } from "@/lib/utils/payment-method";
import { Users } from "lucide-react";

export function SaleForm() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);

  const [pendingProductId, setPendingProductId] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [pendingPriceCents, setPendingPriceCents] = useState(0);

  const [method, setMethod] = useState<PaymentMethod>("dinheiro");
  const [paidCents, setPaidCents] = useState(0);
  const [paidTouched, setPaidTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listActiveCustomers(), listActiveProducts()])
      .then(([c, p]) => {
        setCustomers(c);
        setProducts(p);
      })
      .catch((err) => {
        console.error(err);
        setLoadError(true);
      });
  }, []);

  const totalCents = items.reduce((sum, item) => sum + item.totalCents, 0);

  // Mantém o valor pago acompanhando o total até o usuário editá-lo manualmente
  // (ex: para registrar um pagamento parcial).
  useEffect(() => {
    if (method === "fiado") {
      setPaidCents(0);
    } else if (!paidTouched) {
      setPaidCents(totalCents);
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

    const newItem: SaleItem = {
      productId: product.id,
      productName: product.name,
      quantity: pendingQuantity,
      unitPriceCents: pendingPriceCents,
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

  async function handleSubmit() {
    setFormError(null);

    if (!selectedCustomer) {
      setFormError("Selecione um cliente.");
      return;
    }
    if (items.length === 0) {
      setFormError("Adicione ao menos um produto à venda.");
      return;
    }
    if (paidCents > totalCents) {
      setFormError("O valor pago não pode ser maior que o total.");
      return;
    }

    setSubmitting(true);
    try {
      const saleId = await createSale({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        items,
        totalCents,
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

  if (customers.length === 0 || products.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Cadastre clientes e produtos primeiro"
        description={
          customers.length === 0 && products.length === 0
            ? "Ainda não há clientes nem produtos ativos cadastrados."
            : customers.length === 0
            ? "Ainda não há clientes ativos cadastrados."
            : "Ainda não há produtos ativos cadastrados."
        }
        actionLabel={customers.length === 0 ? "+ Novo cliente" : "+ Novo produto"}
        onAction={() =>
          (window.location.href = customers.length === 0 ? "/clientes" : "/produtos")
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28 md:pb-4">
      <Card>
        <CardHeader>
          <CardTitle>Cliente</CardTitle>
        </CardHeader>
        <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Selecione um cliente</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
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
          disabled={items.length === 0 || !customerId}
        >
          Registrar venda · {formatCurrencyBRL(totalCents)}
        </Button>
      </div>
    </div>
  );
}
