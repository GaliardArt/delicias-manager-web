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
  getProductExtraCost,
  resolveExtraCostTotal,
  resolveProductCost,
  resolveProductCostPerGram,
  resolveRecipeCost,
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
  onSuccess: (savedProduct: Product) => void;
}

export function ProductForm({ product, insumos, ingredientes, onSuccess }: ProductFormProps) {
  const legacyExtraCost = getProductExtraCost(product ?? {});
  const initialRecipeCostCents = resolveRecipeCost(
    product?.recipeItems ?? [],
    toInsumosMap(insumos),
    toIngredientesMap(ingredientes)
  );
  const migratedExtraCostPct =
    initialRecipeCostCents > 0
      ? (resolveExtraCostTotal(product?.yieldQuantity ?? 1, legacyExtraCost) / initialRecipeCostCents) * 100
      : legacyExtraCost.percentage;
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "unidade");
  const [yieldQuantity, setYieldQuantity] = useState(product?.yieldQuantity ?? 1);
  const [yieldWeightGrams, setYieldWeightGrams] = useState(product?.yieldWeightGrams ?? 0);
  const [priceCents, setPriceCents] = useState(product?.priceCents ?? 0);
  const [description, setDescription] = useState(product?.description ?? "");
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>(product?.recipeItems ?? []);
  const [extraCostPct, setExtraCostPct] = useState(
    product?.extraCostPct && product.extraCostPct > 0 ? product.extraCostPct : migratedExtraCostPct
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipeBaseCostCents = useMemo(
    () => resolveRecipeCost(recipeItems, toInsumosMap(insumos), toIngredientesMap(ingredientes)),
    [recipeItems, insumos, ingredientes]
  );
  const extraCost = useMemo(
    () => ({
      ...legacyExtraCost,
      cents: recipeBaseCostCents > 0 ? 0 : legacyExtraCost.cents,
      percentage: extraCostPct,
    }),
    [legacyExtraCost, extraCostPct, recipeBaseCostCents]
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
  const hasCostInfo = recipeItems.length > 0 || extraCostPct > 0 || legacyExtraCost.cents > 0;
  // Quanto o percentual adicional representa por unidade do produto.
  const extraCostPerUnit =
    yieldQuantity > 0
      ? Math.round((recipeBaseCostCents / yieldQuantity) * extraCostPct / 100)
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
        extraCostCents: recipeBaseCostCents > 0 ? 0 : legacyExtraCost.cents,
        extraCostMode: legacyExtraCost.mode,
        extraCostPct,
      };
      let savedProduct: Product;
      if (product) {
        await updateProduct(product.id, input);
        savedProduct = { ...product, ...input };
      } else {
        const id = await createProduct(input);
        savedProduct = { id, ...input, active: true, stockQuantity: 0, createdAt: new Date().toISOString() };
      }
      onSuccess(savedProduct);
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o produto. Nenhum dado foi alterado.");
    } finally {
      setSubmitting(false);
    }
  }

  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-ink-muted";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:gap-5 max-sm:[&_input]:h-9 max-sm:[&_input]:px-2.5 max-sm:[&_select]:h-9 max-sm:[&_label]:text-[11px]">
      {/* --- Informações básicas --- */}
      <section className="flex flex-col gap-2 sm:gap-3">
        <h3 className={sectionTitle + " max-sm:hidden"}>Informações</h3>
        <Input
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Brigadeiro gourmet"
          autoFocus={shouldAutoFocus()}
        />
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
      <section className="flex flex-col gap-2 sm:gap-3">
        <h3 className={sectionTitle + " max-sm:hidden"}>Preço e rendimento</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
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
        <p className="hidden text-xs text-ink-muted sm:block">
          Essa receita rende {yieldQuantity || 0} {unit}. Informe o peso de cada unidade para
          calcular peso total e custo por grama.
        </p>
      </section>

      {/* --- Receita --- */}
      <section className="flex flex-col gap-2 sm:gap-3">
        <div>
          <h3 className={sectionTitle + " max-sm:hidden"}>Receita (opcional)</h3>
          <p className="mt-1 hidden text-xs text-ink-muted sm:block">
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
      <section className="flex flex-col gap-2 sm:gap-3">
        <div>
          <h3 className={sectionTitle + " max-sm:hidden"}>Custo adicional (opcional)</h3>
          <p className="mt-1 hidden text-xs text-ink-muted sm:block">
            Para gastos que não estão na receita: embalagem, gás, mão de obra, etc.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Input
            label="Adicional (%)"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={extraCostPct || ""}
            onChange={(e) => setExtraCostPct(Math.max(0, Number(e.target.value)))}
            placeholder="0"
          />
          <p className="self-end pb-2 text-[10px] leading-tight text-ink-muted sm:text-xs">
            Percentual sobre o custo da receita.
          </p>
        </div>
        {extraCostPct > 0 && (
          <p className="hidden text-xs text-ink-muted sm:block">
            Adicional de {extraCostPct}%: {formatCurrencyBRL(extraCostPerUnit)} por {unit}.
          </p>
        )}
      </section>

      {hasCostInfo && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-2 rounded-xl bg-babypink px-2.5 py-2 text-xs sm:grid-cols-4 sm:gap-3 sm:px-3.5 sm:py-3 sm:text-sm">
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
      <div className="sm:sticky sm:bottom-0 sm:-mx-5 sm:border-t sm:border-line sm:bg-surface sm:px-5 sm:pt-3">
        <Button type="submit" loading={submitting} className="h-9 w-full sm:h-11">
          {product ? "Salvar alterações" : "Cadastrar produto"}
        </Button>
      </div>
    </form>
  );
}
