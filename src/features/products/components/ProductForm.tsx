"use client";

import { useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";
import { RecipeBuilder } from "@/features/recipes/components/RecipeBuilder";
import { ExtraCostMode, Ingrediente, Insumo, Product, RecipeItem } from "@/types";
import { createProduct, updateProduct } from "@/lib/firebase/products";
import {
  getProductExtraCost,
  resolveProductCost,
  resolveProductCostPerGram,
  resolveProductTotalWeightGrams,
  toInsumosMap,
  toIngredientesMap,
} from "@/lib/costing";
import { formatCurrencyBRL } from "@/lib/utils/format";
import { shouldAutoFocus } from "@/lib/utils/device";

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
  const [extraCostCents, setExtraCostCents] = useState(getProductExtraCost(product ?? {}).cents);
  const [extraCostMode, setExtraCostMode] = useState<ExtraCostMode>(
    getProductExtraCost(product ?? {}).mode
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extraCost = useMemo(
    () => ({ cents: extraCostCents, mode: extraCostMode }),
    [extraCostCents, extraCostMode]
  );
  const previewCost = useMemo(
    () =>
      resolveProductCost(
        recipeItems,
        toInsumosMap(insumos),
        toIngredientesMap(ingredientes),
        yieldQuantity,
        extraCost
      ),
    [recipeItems, insumos, ingredientes, yieldQuantity, extraCost]
  );
  // Só existe algo a mostrar no preview se há receita OU custo adicional.
  const hasCostInfo = recipeItems.length > 0 || extraCostCents > 0;
  // Quanto o custo adicional pesa em cada unidade (útil no modo "por receita").
  const extraCostPerUnit =
    yieldQuantity > 0
      ? Math.round((extraCostMode === "receita" ? extraCostCents / yieldQuantity : extraCostCents))
      : 0;
  const previewMargin = priceCents - previewCost;
  const previewMarginPct = priceCents > 0 ? (previewMargin / priceCents) * 100 : 0;
  const previewCostPerGram =
    yieldWeightGrams > 0
      ? resolveProductCostPerGram(
          recipeItems,
          toInsumosMap(insumos),
          toIngredientesMap(ingredientes),
          yieldQuantity,
          yieldWeightGrams,
          extraCost
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
        extraCostCents,
        extraCostMode,
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

  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-ink-muted";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* --- Informações básicas --- */}
      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>Informações</h3>
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Brigadeiro gourmet"
          autoFocus={shouldAutoFocus()}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Doces, Bolos, Biscoitos..."
          />
          <Input
            label="Descrição (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalhes do produto"
          />
        </div>
      </section>

      {/* --- Preço e rendimento --- */}
      <section className="flex flex-col gap-3">
        <h3 className={sectionTitle}>Preço e rendimento</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MoneyInput label="Preço de venda" valueCents={priceCents} onValueCentsChange={setPriceCents} />
          <Select label="Unidade" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
          <Input
            label="Rendimento"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={yieldQuantity}
            onChange={(e) => setYieldQuantity(Number(e.target.value))}
          />
          <Input
            label="Peso/unid. (g)"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={yieldWeightGrams || ""}
            onChange={(e) => setYieldWeightGrams(Number(e.target.value))}
            placeholder="Ex.: 100"
          />
        </div>
        <p className="text-xs text-ink-muted">
          Essa receita rende {yieldQuantity || 0} {unit}. Informe o peso de cada unidade para
          calcular peso total e custo por grama.
        </p>
      </section>

      {/* --- Receita --- */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className={sectionTitle}>Receita (opcional)</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Deixe vazio se não quiser calcular o custo pela receita.
          </p>
        </div>
        <RecipeBuilder
          insumos={insumos}
          ingredientes={ingredientes}
          value={recipeItems}
          onChange={setRecipeItems}
        />
      </section>

      {/* --- Custo adicional --- */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className={sectionTitle}>Custo adicional (opcional)</h3>
          <p className="mt-1 text-xs text-ink-muted">
            Para gastos que não estão na receita: embalagem, gás, mão de obra, etc.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <MoneyInput
            label="Valor"
            valueCents={extraCostCents}
            onValueCentsChange={setExtraCostCents}
          />
          <Select
            label="Como cobrar"
            value={extraCostMode}
            onChange={(e) => setExtraCostMode(e.target.value as ExtraCostMode)}
          >
            <option value="unidade">Por unidade</option>
            <option value="receita">Por receita</option>
          </Select>
        </div>
        {extraCostCents > 0 && (
          <p className="text-xs text-ink-muted">
            {extraCostMode === "receita"
              ? `Diluído no rendimento: ${formatCurrencyBRL(extraCostPerUnit)} por ${unit}.`
              : `Somado ao custo de cada ${unit}.`}
          </p>
        )}
      </section>

      {hasCostInfo && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-babypink px-3.5 py-3 text-sm sm:grid-cols-4">
          <div className="min-w-0">
            <span className="block text-brand-700">Custo / unidade</span>
            <span className="font-semibold text-brand-800">{formatCurrencyBRL(previewCost)}</span>
          </div>
          <div className="min-w-0">
            <span className="block text-brand-700">Custo / grama</span>
            <span className="font-semibold text-brand-800">
              {yieldWeightGrams > 0 ? formatCurrencyBRL(previewCostPerGram) : "—"}
            </span>
          </div>
          <div className="min-w-0">
            <span className="block text-brand-700">Peso total</span>
            <span className="font-semibold text-brand-800">
              {previewTotalWeightGrams > 0
                ? `${previewTotalWeightGrams.toLocaleString("pt-BR")} g`
                : "—"}
            </span>
          </div>
          <div className="min-w-0">
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

      {/* Botão fixo no rodapé da área rolável: nunca some embaixo do formulário. */}
      <div
        className="sticky bottom-0 -mx-4 border-t border-line bg-surface px-4 pt-3 sm:-mx-5 sm:px-5"
        style={{ marginBottom: "calc(-1 * max(1rem, env(safe-area-inset-bottom)))", paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Button type="submit" loading={submitting} className="w-full">
          {product ? "Salvar alterações" : "Cadastrar produto"}
        </Button>
      </div>
    </form>
  );
}
