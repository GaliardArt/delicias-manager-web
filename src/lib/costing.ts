// Motor de custeio: resolve o custo de um Insumo, Ingrediente ou Produto a
// partir da receita (RecipeItem[]). Sempre calculado na hora a partir dos
// dados carregados — nunca um valor "congelado" que possa ficar
// desatualizado quando o preço de um insumo muda (seção 21: confiabilidade
// dos dados > número bonito).
//
// Um Ingrediente pode usar outro Ingrediente na receita (ex: um bolo usa
// brigadeiro, que por sua vez usa leite condensado + cacau). Isso é
// resolvido recursivamente, com proteção contra referência circular.

import { Ingrediente, Insumo, RecipeItem } from "@/types";

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

// Custo de uma unidade do Produto final = custo total da receita dividido pelo
// rendimento do produto. Produtos antigos sem rendimento continuam equivalentes
// ao comportamento anterior usando rendimento 1.
export function resolveProductCost(
  recipeItems: RecipeItem[],
  insumosById: Map<string, Insumo>,
  ingredientesById: Map<string, Ingrediente>,
  yieldQuantity = 1
): number {
  if (yieldQuantity <= 0) return 0;
  return Math.round(resolveRecipeCost(recipeItems, insumosById, ingredientesById) / yieldQuantity);
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
  yieldWeightGrams = 0
): number {
  if (yieldQuantity <= 0 || yieldWeightGrams <= 0) return 0;

  const totalWeightGrams = yieldQuantity * yieldWeightGrams;
  if (totalWeightGrams <= 0) return 0;

  return resolveRecipeCost(recipeItems, insumosById, ingredientesById) / totalWeightGrams;
}

// Peso total produzido pela receita do produto.
export function resolveProductTotalWeightGrams(
  yieldQuantity = 1,
  yieldWeightGrams = 0
): number {
  if (yieldQuantity <= 0 || yieldWeightGrams <= 0) return 0;
  return yieldQuantity * yieldWeightGrams;
}
