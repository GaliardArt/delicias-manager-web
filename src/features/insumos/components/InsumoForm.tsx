"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";
import { Insumo } from "@/types";
import { createInsumo, updateInsumo } from "@/lib/firebase/insumos";
import { formatCurrencyBRL } from "@/lib/utils/format";

const unitOptions = ["g", "kg", "ml", "l", "unidade", "dúzia", "pacote", "caixa"];

interface InsumoFormProps {
  insumo?: Insumo;
  onSuccess: () => void;
}

export function InsumoForm({ insumo, onSuccess }: InsumoFormProps) {
  const [name, setName] = useState(insumo?.name ?? "");
  const [unit, setUnit] = useState(insumo?.unit ?? "g");
  const [purchasePriceCents, setPurchasePriceCents] = useState(insumo?.purchasePriceCents ?? 0);
  const [purchaseQuantity, setPurchaseQuantity] = useState(insumo?.purchaseQuantity ?? 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitCostPreview = purchaseQuantity > 0 ? purchasePriceCents / purchaseQuantity : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome do insumo.");
      return;
    }
    if (purchaseQuantity <= 0) {
      setError("A quantidade precisa ser maior que zero.");
      return;
    }

    setSubmitting(true);
    try {
      const input = { name: name.trim(), unit, purchasePriceCents, purchaseQuantity };
      if (insumo) {
        await updateInsumo(insumo.id, input);
      } else {
        await createInsumo(input);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o insumo. Nenhum dado foi alterado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Leite condensado"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput
          label="Preço pago"
          valueCents={purchasePriceCents}
          onValueCentsChange={setPurchasePriceCents}
        />
        <Input
          label="Quantidade da embalagem"
          type="number"
          min={0}
          step="any"
          value={purchaseQuantity}
          onChange={(e) => setPurchaseQuantity(Number(e.target.value))}
        />
      </div>
      <Select label="Unidade" value={unit} onChange={(e) => setUnit(e.target.value)}>
        {unitOptions.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </Select>
      <p className="text-xs text-ink-muted">
        Ex: paguei {formatCurrencyBRL(purchasePriceCents)} por {purchaseQuantity || 0} {unit}.
      </p>

      <div className="rounded-xl bg-babypink px-3.5 py-3 text-sm">
        <span className="text-brand-700">Custo por {unit}: </span>
        <span className="font-semibold text-brand-800">{formatCurrencyBRL(unitCostPreview)}</span>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="mt-1 w-full">
        {insumo ? "Salvar alterações" : "Cadastrar insumo"}
      </Button>
    </form>
  );
}
