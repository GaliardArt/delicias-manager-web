// Motor de custeio: resolve o custo de um Insumo, Ingrediente ou Produto a
// partir da receita (RecipeItem[]). Sempre calculado na hora a partir dos
// dados carregados — nunca um valor "congelado" que possa ficar
// desatualizado quando o preço de um insumo muda (seção 21: confiabilidade
// dos dados > número bonito).
//
// Um Ingrediente pode usar outro Ingrediente na receita (ex: um bolo usa
// brigadeiro, que por sua vez usa leite condensado + cacau). Isso é
// resolvido recursivamente, com proteção contra referência circular.

import { ExtraCostMode, Ingrediente, Insumo, Product, RecipeItem } from "@/types";

export function resolveIngredienteUnitCost(
  ingrediente: Ingrediente,
  insumosById: Map<string, Insumo>,
  ingredientesById: Map<string, Ingrediente>,
  visiting: Set<string> = new Set()
): number {
  if (visiting.has(ingrediente.id)) return 0; // ciclo detectado — evita loop infinito
  if (ingrediente.yieldQuantity <= 0) return 0;

  visiting.add(ingrediente.id);
  const totalCents = resolveRecipeCost(
    ingrediente.recipeItems,
    insumosById,
    ingredientesById,
    visiting
  );
  visiting.delete(ingrediente.id);

  return totalCents / ingrediente.yieldQuantity;
}

export function resolveRecipeCost(
  recipeItems: RecipeItem[],
  insumosById: Map<string, Insumo>,
  ingredientesById: Map<string, Ingrediente>,
  visiting: Set<string> = new Set()
): number {
  return recipeItems.reduce((sum, item) => {
    if (item.sourceType === "insumo") {
      const insumo = insumosById.get(item.sourceId);
      return sum + (insumo ? insumo.unitCostCents * item.quantity : 0);
    }
    const sub = ingredientesById.get(item.sourceId);
    if (!sub) return sum;
    const subUnitCost = resolveIngredienteUnitCost(sub, insumosById, ingredientesById, visiting);
    return sum + subUnitCost * item.quantity;
  }, 0);
}

// Custo adicional opcional de um produto (embalagem, gás, mão de obra...).
export interface ProductExtraCost {
  cents: number;
  mode: ExtraCostMode;
  percentage: number;
}

// Extrai o custo adicional de um Product tolerando dados antigos (sem os campos).
export function getProductExtraCost(
  product: Partial<Pick<Product, "extraCostCents" | "extraCostMode" | "extraCostPct">>
): ProductExtraCost {
  return {
    cents: Math.max(0, Number(product.extraCostCents ?? 0)),
    mode: product.extraCostMode === "receita" ? "receita" : "unidade",
    percentage: Math.max(0, Number(product.extraCostPct ?? 0)),
  };
}

// Custo adicional TOTAL de uma receita inteira (antes de dividir pelo rendimento).
export function resolveExtraCostTotal(
  yieldQuantity: number,
  extraCost?: ProductExtraCost,
  recipeTotalCents = 0
): number {
  if (!extraCost || yieldQuantity <= 0) return 0;
  const fixedCents =
    extraCost.cents <= 0
      ? 0
      : extraCost.mode === "receita"
        ? extraCost.cents
        : extraCost.cents * yieldQuantity;
  const percentageCents = Math.round(
    Math.max(0, recipeTotalCents) * Math.max(0, extraCost.percentage) / 100
  );
  return fixedCents + percentageCents;
}

// Custo de uma unidade do Produto final = (custo total da receita + custo adicional)
// dividido pelo rendimento do produto. Produtos antigos sem rendimento continuam
// equivalentes ao comportamento anterior usando rendimento 1, e sem custo adicional
// (parâmetro opcional) o resultado é exatamente o mesmo de antes.
export function resolveProductCost(
  recipeItems: RecipeItem[],
  insumosById: Map<string, Insumo>,
  ingredientesById: Map<string, Ingrediente>,
  yieldQuantity = 1,
  extraCost?: ProductExtraCost
): number {
  if (yieldQuantity <= 0) return 0;
  const recipeTotal = resolveRecipeCost(recipeItems, insumosById, ingredientesById);
  return Math.round(
    (recipeTotal + resolveExtraCostTotal(yieldQuantity, extraCost, recipeTotal)) / yieldQuantity
  );
}

export function toInsumosMap(insumos: Insumo[]): Map<string, Insumo> {
  return new Map(insumos.map((i) => [i.id, i]));
}

export function toIngredientesMap(ingredientes: Ingrediente[]): Map<string, Ingrediente> {
  return new Map(ingredientes.map((i) => [i.id, i]));
}


// Custo total da receita de um produto, antes de dividir pelo rendimento.
export function resolveProductRecipeTotalCost(
  recipeItems: RecipeItem[],
  insumosById: Map<string, Insumo>,
  ingredientesById: Map<string, Ingrediente>
): number {
  return resolveRecipeCost(recipeItems, insumosById, ingredientesById);
}

// Custo por grama do produto final. O peso é opcional: sem peso válido,
// retorna 0 para não inventar precisão em produtos antigos.
export function resolveProductCostPerGram(
  recipeItems: RecipeItem[],
  insumosById: Map<string, Insumo>,
  ingredientesById: Map<string, Ingrediente>,
  yieldQuantity = 1,
  yieldWeightGrams = 0,
  extraCost?: ProductExtraCost
): number {
  if (yieldQuantity <= 0 || yieldWeightGrams <= 0) return 0;

  const totalWeightGrams = yieldQuantity * yieldWeightGrams;
  if (totalWeightGrams <= 0) return 0;

  const recipeTotal = resolveRecipeCost(recipeItems, insumosById, ingredientesById);
  const totalCost = recipeTotal + resolveExtraCostTotal(yieldQuantity, extraCost, recipeTotal);
  return totalCost / totalWeightGrams;
}

// Peso total produzido pela receita do produto.
export function resolveProductTotalWeightGrams(
  yieldQuantity = 1,
  yieldWeightGrams = 0
): number {
  if (yieldQuantity <= 0 || yieldWeightGrams <= 0) return 0;
  return yieldQuantity * yieldWeightGrams;
}
