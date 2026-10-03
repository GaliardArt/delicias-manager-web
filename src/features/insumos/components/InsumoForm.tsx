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

// Unidades que já têm conversão fixa pra outras (g<->kg, ml<->l, unidade<->dúzia)
// não precisam da conversão personalizada — ela só faz sentido pra embalagens
// de tamanho variável.
const unitsWithBuiltInConversion = new Set(["g", "kg", "ml", "l", "unidade", "dúzia"]);

interface InsumoFormProps {
  insumo?: Insumo;
  onSuccess: (savedInsumo: Insumo) => void;
}

export function InsumoForm({ insumo, onSuccess }: InsumoFormProps) {
  const [name, setName] = useState(insumo?.name ?? "");
  const [unit, setUnit] = useState(insumo?.unit ?? "g");
  const [purchasePriceCents, setPurchasePriceCents] = useState(insumo?.purchasePriceCents ?? 0);
  const [purchaseQuantity, setPurchaseQuantity] = useState(insumo?.purchaseQuantity ?? 1);
  const [usePackageConversion, setUsePackageConversion] = useState(
    Boolean(insumo?.packageUnit && insumo?.packageQuantity)
  );
  const [packageUnit, setPackageUnit] = useState(insumo?.packageUnit ?? "unidade");
  const [packageQuantity, setPackageQuantity] = useState(insumo?.packageQuantity ?? 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unitCostPreview = purchaseQuantity > 0 ? purchasePriceCents / purchaseQuantity : 0;
  const showPackageConversion = !unitsWithBuiltInConversion.has(unit);

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
    if (showPackageConversion && usePackageConversion) {
      if (!packageUnit.trim()) {
        setError("Informe o nome da unidade usada nas receitas.");
        return;
      }
      if (packageQuantity <= 0) {
        setError("A quantidade da conversão precisa ser maior que zero.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        unit,
        purchasePriceCents,
        purchaseQuantity,
        ...(showPackageConversion && usePackageConversion
          ? { packageUnit: packageUnit.trim(), packageQuantity }
          : {}),
      };
      let savedInsumo: Insumo;
      if (insumo) {
        await updateInsumo(insumo.id, input);
        savedInsumo = {
          ...insumo,
          name: input.name,
          unit: input.unit,
          purchasePriceCents: input.purchasePriceCents,
          purchaseQuantity: input.purchaseQuantity,
          packageUnit: input.packageUnit,
          packageQuantity: input.packageQuantity,
          unitCostCents: input.purchaseQuantity > 0 ? input.purchasePriceCents / input.purchaseQuantity : 0,
        };
      } else {
        const id = await createInsumo(input);
        savedInsumo = {
          id,
          ...input,
          unitCostCents: input.purchaseQuantity > 0 ? input.purchasePriceCents / input.purchaseQuantity : 0,
          stockQuantity: 0,
          active: true,
          createdAt: new Date().toISOString(),
        };
      }
      onSuccess(savedInsumo);
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o insumo. Nenhum dado foi alterado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:gap-3 max-sm:[&_input]:h-10 max-sm:[&_input]:px-3 max-sm:[&_select]:h-10 max-sm:[&_label]:text-xs">
      <Input
        label="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Leite condensado"
        className="text-sm"
      />
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
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

      {showPackageConversion && (
        <div className="rounded-xl border border-line p-2">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={usePackageConversion}
              onChange={(e) => setUsePackageConversion(e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            Permitir lançar em outra unidade nas receitas
          </label>
          <p className="mt-1 text-[10px] leading-tight text-ink-muted">
            "{unit}" não converte sozinho pra outra unidade (ao contrário de g/kg ou ml/l). Se
            quiser lançar a quantidade em receitas usando, por exemplo, "unidade" em vez de "
            {unit}", informe quanto equivale a 1 {unit}.
          </p>
          {usePackageConversion && (
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <Input
                label={`1 ${unit} equivale a`}
                type="number"
                min={0}
                step="any"
                value={packageQuantity}
                onChange={(e) => setPackageQuantity(Number(e.target.value))}
              />
              <Input
                label="Unidade"
                value={packageUnit}
                onChange={(e) => setPackageUnit(e.target.value)}
                placeholder="unidade"
                className="w-28"
              />
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl bg-babypink px-3 py-2 text-xs sm:px-3.5 sm:py-3 sm:text-sm">
        <span className="text-brand-700">Custo por {unit}: </span>
        <span className="font-semibold text-brand-800">{formatCurrencyBRL(unitCostPreview)}</span>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="h-10 w-full sm:h-11">
        {insumo ? "Salvar alterações" : "Cadastrar insumo"}
      </Button>
    </form>
  );
}

