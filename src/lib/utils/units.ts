// Conversão de unidades para os itens de receita (RecipeBuilder).
//
// Cada Insumo/Ingrediente tem uma unidade-base (a unidade em que o
// unitCostCents foi calculado — ex: um insumo comprado "por kg"). Este
// utilitário permite que, na hora de montar uma receita, a quantidade seja
// digitada numa unidade diferente (ex: gramas) e seja convertida
// automaticamente para a unidade-base antes de calcular o custo, mantendo o
// motor de custeio (src/lib/costing.ts) simples e sempre correto.
//
// Duas fontes de conversão:
// 1. Unidades padrão de massa/volume/contagem (g<->kg, ml<->l, unidade<->dúzia),
//    fixas e sempre disponíveis.
// 2. Uma conversão personalizada por insumo/ingrediente (packageUnit +
//    packageQuantity), para os casos em que a unidade-base é uma embalagem
//    cujo tamanho varia (ex: "1 caixa = 30 unidades", "1 pacote = 500 g") —
//    isso não dá pra saber sem o usuário informar.

export type UnitCategory = "massa" | "volume" | "contagem";

interface StandardUnitDef {
  value: string;
  label: string;
  category: UnitCategory;
  toBase: number; // fator para converter 1 desta unidade na unidade canônica da categoria (g, ml ou unidade)
}

// Unidades canônicas por categoria: massa -> g, volume -> ml, contagem -> unidade.
export const STANDARD_UNITS: StandardUnitDef[] = [
  { value: "g", label: "g", category: "massa", toBase: 1 },
  { value: "kg", label: "kg", category: "massa", toBase: 1000 },
  { value: "ml", label: "ml", category: "volume", toBase: 1 },
  { value: "l", label: "l", category: "volume", toBase: 1000 },
  { value: "unidade", label: "unidade", category: "contagem", toBase: 1 },
  { value: "dúzia", label: "dúzia", category: "contagem", toBase: 12 },
];

export function getUnitCategory(unit: string): UnitCategory | null {
  return STANDARD_UNITS.find((u) => u.value === unit)?.category ?? null;
}

export interface UnitOption {
  value: string;
  label: string;
}

// Unidades que podem ser usadas para digitar a quantidade de um item de
// receita cujo insumo/ingrediente está cadastrado na unidade `baseUnit`.
// Sempre inclui a própria unidade-base. Se `baseUnit` for uma unidade padrão
// (g, kg, ml, l, unidade, dúzia), também inclui as demais unidades da mesma
// categoria (ex: base "kg" -> também oferece "g"). Se houver uma conversão
// personalizada cadastrada (packageUnit/packageQuantity), essa unidade
// também entra nas opções.
export function getCompatibleUnits(
  baseUnit: string,
  packageUnit?: string,
  packageQuantity?: number
): UnitOption[] {
  const category = getUnitCategory(baseUnit);
  const options: UnitOption[] = [{ value: baseUnit, label: baseUnit }];

  if (category) {
    for (const u of STANDARD_UNITS) {
      if (u.category === category && u.value !== baseUnit) {
        options.push({ value: u.value, label: u.label });
      }
    }
  }

  if (packageUnit && packageQuantity && packageQuantity > 0 && packageUnit !== baseUnit) {
    options.push({
      value: packageUnit,
      label: `${packageUnit} (1 ${baseUnit} = ${packageQuantity} ${packageUnit})`,
    });
  }

  return options;
}

// Converte `quantity`, digitada na unidade `fromUnit`, para a unidade-base
// (`baseUnit`) do insumo/ingrediente — a unidade em que unitCostCents está
// definido. Retorna null quando não existe conversão conhecida entre as
// unidades (nesse caso o chamador deve manter a quantidade como está, sem
// fingir uma conversão).
export function convertToBaseUnit(
  quantity: number,
  fromUnit: string,
  baseUnit: string,
  packageUnit?: string,
  packageQuantity?: number
): number | null {
  if (fromUnit === baseUnit) return quantity;

  if (packageUnit && packageQuantity && packageQuantity > 0 && fromUnit === packageUnit) {
    return quantity / packageQuantity;
  }

  const from = STANDARD_UNITS.find((u) => u.value === fromUnit);
  const base = STANDARD_UNITS.find((u) => u.value === baseUnit);
  if (from && base && from.category === base.category) {
    return (quantity * from.toBase) / base.toBase;
  }

  return null;
}
