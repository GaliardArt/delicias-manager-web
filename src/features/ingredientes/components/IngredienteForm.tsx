"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { RecipeBuilder } from "@/features/recipes/components/RecipeBuilder";
import { Ingrediente, Insumo, RecipeItem } from "@/types";
import { createIngrediente, updateIngrediente } from "@/lib/firebase/ingredientes";
import { resolveIngredienteUnitCost, toInsumosMap, toIngredientesMap } from "@/lib/costing";
import { formatCurrencyBRL } from "@/lib/utils/format";

const unitOptions = ["g", "kg", "ml", "l", "unidade", "dúzia"];

interface IngredienteFormProps {
  ingrediente?: Ingrediente;
  insumos: Insumo[];
  allIngredientes: Ingrediente[];
  onSuccess: () => void;
}

export function IngredienteForm({
  ingrediente,
  insumos,
  allIngredientes,
  onSuccess,
}: IngredienteFormProps) {
  const [name, setName] = useState(ingrediente?.name ?? "");
  const [yieldQuantity, setYieldQuantity] = useState(ingrediente?.yieldQuantity ?? 1);
  const [yieldUnit, setYieldUnit] = useState(ingrediente?.yieldUnit ?? "unidade");
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>(ingrediente?.recipeItems ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Não pode usar a si mesmo na receita (evita ciclo óbvio na hora de montar).
  const availableIngredientes = allIngredientes.filter((i) => i.id !== ingrediente?.id);

  const previewCost = useMemo(() => {
    const draft: Ingrediente = {
      id: ingrediente?.id ?? "__draft__",
      name,
      yieldQuantity,
      yieldUnit,
      recipeItems,
      unitCostCents: 0,
      stockQuantity: 0,
      active: true,
      createdAt: "",
    };
    return resolveIngredienteUnitCost(
      draft,
      toInsumosMap(insumos),
      toIngredientesMap(availableIngredientes)
    );
  }, [name, yieldQuantity, yieldUnit, recipeItems, insumos, availableIngredientes, ingrediente?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome do ingrediente.");
      return;
    }
    if (yieldQuantity <= 0) {
      setError("O rendimento precisa ser maior que zero.");
      return;
    }

    setSubmitting(true);
    try {
      const input = { name: name.trim(), yieldQuantity, yieldUnit, recipeItems };
      if (ingrediente) {
        await updateIngrediente(ingrediente.id, input, insumos, availableIngredientes);
      } else {
        await createIngrediente(input, insumos, availableIngredientes);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o ingrediente. Nenhum dado foi alterado.");
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
        placeholder="Brigadeiro"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Rendimento"
          type="number"
          min={0}
          step="any"
          value={yieldQuantity}
          onChange={(e) => setYieldQuantity(Number(e.target.value))}
        />
        <Select label="Unidade" value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value)}>
          {unitOptions.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-xs text-ink-muted">
        Ex: essa receita rende {yieldQuantity || 0} {yieldUnit} de {name || "ingrediente"}.
      </p>

      <div>
        <p className="mb-1.5 text-sm font-medium text-ink-muted">Receita</p>
        <RecipeBuilder
          insumos={insumos}
          ingredientes={availableIngredientes}
          value={recipeItems}
          onChange={setRecipeItems}
        />
      </div>

      <div className="rounded-xl bg-babypink px-3.5 py-3 text-sm">
        <span className="text-brand-700">Custo calculado: </span>
        <span className="font-semibold text-brand-800">
          {formatCurrencyBRL(previewCost)} / {yieldUnit}
        </span>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="mt-1 w-full">
        {ingrediente ? "Salvar alterações" : "Cadastrar ingrediente"}
      </Button>
    </form>
  );
}
