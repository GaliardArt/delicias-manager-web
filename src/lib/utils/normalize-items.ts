import { SaleItem } from "@/types";

// Documentos de vendas/encomendas criados antes do sistema de custos não têm
// unitCostCents — entra como 0 (sem custo conhecido) em vez de undefined, pra
// nunca virar NaN nos cálculos de lucro.
export function normalizeSaleItems(rawItems: unknown): SaleItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    unitCostCents: item.unitCostCents ?? 0,
    totalCents: item.totalCents,
  }));
}
