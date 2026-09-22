"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";
import { Insumo } from "@/types";
import { registerInsumoPurchase } from "@/lib/firebase/insumos";
import { formatCurrencyBRL } from "@/lib/utils/format";

interface RegisterPurchaseFormProps {
  insumo: Insumo;
  onSuccess: () => void;
}

export function RegisterPurchaseForm({ insumo, onSuccess }: RegisterPurchaseFormProps) {
  const [priceCents, setPriceCents] = useState(insumo.purchasePriceCents);
  const [quantity, setQuantity] = useState(insumo.purchaseQuantity);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitCostPreview = quantity > 0 ? priceCents / quantity : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (quantity <= 0) {
      setError("A quantidade precisa ser maior que zero.");
      return;
    }
    setSubmitting(true);
    try {
      await registerInsumoPurchase(insumo.id, priceCents, quantity);
      onSuccess();
    } catch (err) {
      console.error(err);
      setError("Não foi possível registrar a compra. Nenhum dado foi alterado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Estoque atual: <span className="font-semibold text-ink">{insumo.stockQuantity} {insumo.unit}</span>.
        Isso vai somar ao estoque e atualizar o custo por unidade.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label="Preço pago agora" valueCents={priceCents} onValueCentsChange={setPriceCents} />
        <Input
          label={`Quantidade (${insumo.unit})`}
          type="number"
          min={0}
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </div>
      <div className="rounded-xl bg-babypink px-3.5 py-3 text-sm">
        <span className="text-brand-700">Novo custo por {insumo.unit}: </span>
        <span className="font-semibold text-brand-800">{formatCurrencyBRL(unitCostPreview)}</span>
      </div>
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="w-full">
        Registrar compra
      </Button>
    </form>
  );
}
