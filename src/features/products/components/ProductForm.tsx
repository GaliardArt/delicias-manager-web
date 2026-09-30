"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";
import { RecipeBuilder } from "@/features/recipes/components/RecipeBuilder";
import { Ingrediente, Insumo, Product, RecipeItem } from "@/types";
import { createProduct, updateProduct } from "@/lib/firebase/products";
import {
  resolveProductCost,
  resolveProductCostPerGram,
  resolveProductTotalWeightGrams,
  toInsumosMap,
  toIngredientesMap,
} from "@/lib/costing";
import { formatCurrencyBRL } from "@/lib/utils/format";

const unitOptions = ["unidade", "caixa", "pacote", "kg", "dúzia"];

interface ProductFormProps {
  product?: Product;
  insumos: Insumo[];
  ingredientes: Ingrediente[];
  onSuccess: () => void;
}

export function ProductForm({ product, insumos, ingredientes, onSuccess }: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "unidade");
  const [yieldQuantity, setYieldQuantity] = useState(product?.yieldQuantity ?? 1);
  const [yieldWeightGrams, setYieldWeightGrams] = useState(product?.yieldWeightGrams ?? 0);
  const [priceCents, setPriceCents] = useState(product?.priceCents ?? 0);
  const [description, setDescription] = useState(product?.description ?? "");
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>(product?.recipeItems ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewCost = useMemo(
    () =>
      resolveProductCost(
        recipeItems,
        toInsumosMap(insumos),
        toIngredientesMap(ingredientes),
        yieldQuantity
      ),
    [recipeItems, insumos, ingredientes, yieldQuantity]
  );
  const previewMargin = priceCents - previewCost;
  const previewMarginPct = priceCents > 0 ? (previewMargin / priceCents) * 100 : 0;
  const previewCostPerGram =
    yieldWeightGrams > 0
      ? resolveProductCostPerGram(
          recipeItems,
          toInsumosMap(insumos),
          toIngredientesMap(ingredientes),
          yieldQuantity,
          yieldWeightGrams
        )
      : 0;
  const previewTotalWeightGrams = resolveProductTotalWeightGrams(
    yieldQuantity,
    yieldWeightGrams
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    if (priceCents <= 0) {
      setError("Informe um preço maior que zero.");
      return;
    }
    if (yieldQuantity <= 0) {
      setError("O rendimento precisa ser maior que zero.");
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        category: category.trim() || "Geral",
        unit,
        yieldQuantity,
        yieldWeightGrams: Math.max(0, yieldWeightGrams || 0),
        priceCents,
        description: description.trim(),
        recipeItems,
      };
      if (product) {
        await updateProduct(product.id, input);
      } else {
        await createProduct(input);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o produto. Nenhum dado foi alterado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:gap-3 max-sm:[&_input]:h-10 max-sm:[&_input]:px-3 max-sm:[&_select]:h-10 max-sm:[&_label]:text-xs">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Brigadeiro gourmet"
          className="text-sm"
        />
        <Input
          label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Doces, bolos..."
          className="text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <MoneyInput label="Preço de venda" valueCents={priceCents} onValueCentsChange={setPriceCents} />
        <Select label="Unidade" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {unitOptions.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div>
          <Input
            label="Rendimento"
            type="number"
            min={0}
            step="any"
            value={yieldQuantity}
            onChange={(e) => setYieldQuantity(Number(e.target.value))}
          />
          <p className="mt-1 hidden text-[10px] leading-tight text-ink-muted sm:block">
            Ex: essa receita rende {yieldQuantity || 0} {unit}.
          </p>
        </div>
        <div>
          <Input
            label="Peso de cada unidade (g)"
            type="number"
            min={0}
            step="any"
            value={yieldWeightGrams || ""}
            onChange={(e) => setYieldWeightGrams(Number(e.target.value))}
            placeholder="Ex.: 100"
          />
          <p className="mt-1 hidden text-[10px] leading-tight text-ink-muted sm:block">
            Informe para calcular peso total e custo por grama.
          </p>
        </div>
      </div>
      <Input
        label="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Detalhes do produto"
        className="text-sm"
      />

      <div>
        <p className="mb-1 text-xs font-medium text-ink-muted">
          Receita (opcional — deixe vazio se não quiser calcular o custo)
        </p>
        <RecipeBuilder
          insumos={insumos}
          ingredientes={ingredientes}
          value={recipeItems}
          onChange={setRecipeItems}
        />
      </div>

      {recipeItems.length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-babypink px-3 py-2 text-xs sm:grid-cols-4 sm:gap-3 sm:px-3.5 sm:py-3 sm:text-sm">
          <div>
            <span className="block text-brand-700">Custo / unidade</span>
            <span className="font-semibold text-brand-800">{formatCurrencyBRL(previewCost)}</span>
          </div>
          <div>
            <span className="block text-brand-700">Custo / grama</span>
            <span className="font-semibold text-brand-800">
              {yieldWeightGrams > 0 ? formatCurrencyBRL(previewCostPerGram) : "—"}
            </span>
          </div>
          <div>
            <span className="block text-brand-700">Peso total</span>
            <span className="font-semibold text-brand-800">
              {previewTotalWeightGrams > 0
                ? `${previewTotalWeightGrams.toLocaleString("pt-BR")} g`
                : "—"}
            </span>
          </div>
          <div>
            <span className="block text-brand-700">Margem</span>
            <span className="font-semibold text-brand-800">
              {formatCurrencyBRL(previewMargin)} ({previewMarginPct.toFixed(0)}%)
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="h-10 w-full sm:h-11">
        {product ? "Salvar alterações" : "Cadastrar produto"}
      </Button>
    </form>
  );
}
