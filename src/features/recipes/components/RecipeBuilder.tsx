"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Ingrediente, Insumo, RecipeItem } from "@/types";
import { formatCurrencyBRL } from "@/lib/utils/format";

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

  function handleAdd() {
    if (!pendingKey || pendingQuantity <= 0) return;
    const [type, id] = pendingKey.split(":") as ["insumo" | "ingrediente", string];

    const source =
      type === "insumo" ? insumos.find((i) => i.id === id) : ingredientes.find((i) => i.id === id);
    if (!source) return;

    const unit = type === "insumo" ? (source as Insumo).unit : (source as Ingrediente).yieldUnit;

    onChange([
      ...value,
      {
        sourceType: type,
        sourceId: id,
        sourceName: source.name,
        quantity: pendingQuantity,
        unit,
      },
    ]);
    setPendingKey("");
    setPendingQuantity(1);
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {value.map((item, index) => (
            <li key={index} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{item.sourceName}</p>
                <p className="text-xs text-ink-muted">
                  {item.quantity} {item.unit}
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
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Select
          label="Insumo ou ingrediente"
          value={pendingKey}
          onChange={(e) => setPendingKey(e.target.value)}
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
        <Button type="button" variant="secondary" onClick={handleAdd} disabled={!pendingKey}>
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
