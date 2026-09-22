"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Ingrediente, Insumo, RecipeItem } from "@/types";
import { formatCurrencyBRL } from "@/lib/utils/format";
import { convertToBaseUnit, getCompatibleUnits } from "@/lib/utils/units";

interface RecipeBuilderProps {
  insumos: Insumo[];
  ingredientes: Ingrediente[];
  value: RecipeItem[];
  onChange: (items: RecipeItem[]) => void;
}

function encodeKey(type: "insumo" | "ingrediente", id: string) {
  return `${type}:${id}`;
}

export function RecipeBuilder({ insumos, ingredientes, value, onChange }: RecipeBuilderProps) {
  const [pendingKey, setPendingKey] = useState("");
  const [pendingQuantity, setPendingQuantity] = useState(1);
  const [pendingUnit, setPendingUnit] = useState("");
  const [conversionError, setConversionError] = useState<string | null>(null);

  const pendingSource = useMemo(() => {
    if (!pendingKey) return null;
    const [type, id] = pendingKey.split(":") as ["insumo" | "ingrediente", string];
    const source =
      type === "insumo" ? insumos.find((i) => i.id === id) : ingredientes.find((i) => i.id === id);
    return source ? { type, source } : null;
  }, [pendingKey, insumos, ingredientes]);

  // Unidades que dá pra usar pra digitar a quantidade deste item — a
  // unidade-base do insumo/ingrediente, outras unidades da mesma categoria
  // (g<->kg, ml<->l, unidade<->dúzia) e, se o insumo tiver, sua conversão
  // personalizada (ex: caixa -> unidade).
  const unitOptions = useMemo(() => {
    if (!pendingSource) return [];
    const baseUnit =
      pendingSource.type === "insumo"
        ? (pendingSource.source as Insumo).unit
        : (pendingSource.source as Ingrediente).yieldUnit;
    const packageUnit =
      pendingSource.type === "insumo" ? (pendingSource.source as Insumo).packageUnit : undefined;
    const packageQuantity =
      pendingSource.type === "insumo" ? (pendingSource.source as Insumo).packageQuantity : undefined;
    return getCompatibleUnits(baseUnit, packageUnit, packageQuantity);
  }, [pendingSource]);

  function handleSelectSource(key: string) {
    setPendingKey(key);
    setConversionError(null);
    if (!key) {
      setPendingUnit("");
      return;
    }
    const [type, id] = key.split(":") as ["insumo" | "ingrediente", string];
    const source = type === "insumo" ? insumos.find((i) => i.id === id) : ingredientes.find((i) => i.id === id);
    const baseUnit = source
      ? type === "insumo"
        ? (source as Insumo).unit
        : (source as Ingrediente).yieldUnit
      : "";
    setPendingUnit(baseUnit);
  }

  function handleAdd() {
    setConversionError(null);
    if (!pendingKey || pendingQuantity <= 0 || !pendingSource) return;

    const { type, source } = pendingSource;
    const baseUnit = type === "insumo" ? (source as Insumo).unit : (source as Ingrediente).yieldUnit;
    const packageUnit = type === "insumo" ? (source as Insumo).packageUnit : undefined;
    const packageQuantity = type === "insumo" ? (source as Insumo).packageQuantity : undefined;

    const converted = convertToBaseUnit(pendingQuantity, pendingUnit, baseUnit, packageUnit, packageQuantity);
    if (converted === null) {
      setConversionError(`Não sei converter de "${pendingUnit}" para "${baseUnit}". Ajuste a unidade escolhida.`);
      return;
    }

    onChange([
      ...value,
      {
        sourceType: type,
        sourceId: source.id,
        sourceName: source.name,
        quantity: converted,
        unit: baseUnit,
        enteredQuantity: pendingQuantity,
        enteredUnit: pendingUnit,
      },
    ]);
    setPendingKey("");
    setPendingQuantity(1);
    setPendingUnit("");
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {value.map((item, index) => {
            // Itens antigos (criados antes desta conversão existir) não têm
            // enteredQuantity/enteredUnit — mostra a quantidade normal nesse caso.
            const displayQuantity = item.enteredQuantity ?? item.quantity;
            const displayUnit = item.enteredUnit ?? item.unit;
            const showsConversion = item.enteredUnit && item.enteredUnit !== item.unit;
            return (
              <li key={index} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.sourceName}</p>
                  <p className="text-xs text-ink-muted">
                    {displayQuantity} {displayUnit}
                    {showsConversion && (
                      <span className="text-ink-faint"> (= {item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {item.unit})</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="shrink-0 text-ink-faint hover:text-danger-500"
                  aria-label="Remover item da receita"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <Select
          label="Insumo ou ingrediente"
          value={pendingKey}
          onChange={(e) => handleSelectSource(e.target.value)}
        >
          <option value="">Selecione</option>
          {insumos.length > 0 && (
            <optgroup label="Insumos">
              {insumos.map((i) => (
                <option key={i.id} value={encodeKey("insumo", i.id)}>
                  {i.name} ({formatCurrencyBRL(i.unitCostCents)}/{i.unit})
                </option>
              ))}
            </optgroup>
          )}
          {ingredientes.length > 0 && (
            <optgroup label="Ingredientes">
              {ingredientes.map((i) => (
                <option key={i.id} value={encodeKey("ingrediente", i.id)}>
                  {i.name} ({formatCurrencyBRL(i.unitCostCents)}/{i.yieldUnit})
                </option>
              ))}
            </optgroup>
          )}
        </Select>
        <Input
          label="Quantidade"
          type="number"
          min={0}
          step="any"
          value={pendingQuantity}
          onChange={(e) => setPendingQuantity(Number(e.target.value))}
          className="w-full sm:w-28"
        />
        <Select
          label="Unidade"
          value={pendingUnit}
          onChange={(e) => setPendingUnit(e.target.value)}
          disabled={!pendingSource}
          className="w-full sm:w-32"
        >
          {unitOptions.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </Select>
        <Button type="button" variant="secondary" onClick={handleAdd} disabled={!pendingKey}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
      {conversionError && <p className="text-xs text-danger-500">{conversionError}</p>}
    </div>
  );
}

