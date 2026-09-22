"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle, Users } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { Customer, Ingrediente, Insumo, OrderStatus, PaymentMethod, Product, SaleItem } from "@/types";
import { listActiveCustomers } from "@/lib/firebase/customers";
import { listActiveProducts } from "@/lib/firebase/products";
import { listActiveInsumos } from "@/lib/firebase/insumos";
import { listActiveIngredientes } from "@/lib/firebase/ingredientes";
import { createOrder } from "@/lib/firebase/orders";
import { resolveProductCost, toInsumosMap, toIngredientesMap } from "@/lib/costing";
import { formatCurrencyBRL, localIsoPlusDays } from "@/lib/utils/format";
import { paymentMethodOptions } from "@/lib/utils/payment-method";
import { orderStatusLabel } from "@/lib/utils/order-status";

const statusOptions: OrderStatus[] = ["pendente", "confirmada", "em_producao", "pronta"];

export function OrderForm() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loadError, setLoadError] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [expectedDate, setExpectedDate] = useState(localIsoPlusDays(3));
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<OrderStatus>("pendente");

  const [pendingProductId, setPendingProductId] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [pendingPriceCents, setPendingPriceCents] = useState(0);

  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [paidCents, setPaidCents] = useState(0);

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

  const totalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const pendingCents = totalCents - paidCents;
  const selectedCustomer = customers?.find((c) => c.id === customerId);

  function handleSelectCustomer(id: string) {
    setCustomerId(id);
    const customer = customers?.find((c) => c.id === id);
    if (customer?.address && !deliveryAddress) {
      setDeliveryAddress(customer.address);
    }
  }

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

    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        quantity: pendingQuantity,
        unitPriceCents: pendingPriceCents,
        unitCostCents,
        totalCents: pendingQuantity * pendingPriceCents,
      },
    ]);
    setPendingProductId("");
    setPendingQuantity(1);
    setPendingPriceCents(0);
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setFormError(null);

    if (!selectedCustomer) {
      setFormError("Selecione um cliente.");
      return;
    }
    if (items.length === 0) {
      setFormError("Adicione ao menos um produto à encomenda.");
      return;
    }
    if (!expectedDate) {
      setFormError("Informe a data prevista de entrega.");
      return;
    }
    if (paidCents > totalCents) {
      setFormError("O valor pago não pode ser maior que o total.");
      return;
    }

    setSubmitting(true);
    try {
      const orderId = await createOrder({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        items,
        totalCents,
        expectedDate,
        deliveryAddress,
        notes,
        status,
        initialPaymentCents: paidCents,
        initialPaymentMethod: method,
      });
      router.push(`/encomendas/${orderId}`);
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error
          ? err.message
          : "Não foi possível registrar a encomenda. Nenhum dado foi alterado."
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
          customers.length === 0
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
          <CardTitle>Cliente e entrega</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3">
          <Select value={customerId} onChange={(e) => handleSelectCustomer(e.target.value)}>
            <option value="">Selecione um cliente</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Data prevista de entrega"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabel[s]}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Endereço de entrega (opcional)"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            placeholder="Rua das Flores, 120"
          />
          <Input
            label="Observações (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Escrever 'Feliz aniversário' no bolo, por exemplo"
          />
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
          <CardTitle>Sinal / pagamento (opcional)</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Forma de pagamento"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
          >
            {paymentMethodOptions
              .filter((opt) => opt.value !== "fiado")
              .map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
          </Select>
          <MoneyInput
            label="Valor pago agora"
            valueCents={paidCents}
            onValueCentsChange={setPaidCents}
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
          Registrar encomenda · {formatCurrencyBRL(totalCents)}
        </Button>
      </div>
    </div>
  );
}
