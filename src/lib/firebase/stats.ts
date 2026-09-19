import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "./config";

interface RawSaleDoc {
  customerId: string;
  totalCents: number;
  pendingCents: number;
  createdAt: { toDate: () => Date } | null;
  items: { productId: string; productName: string; quantity: number; totalCents: number }[];
}

export interface CustomerStats {
  totalPurchasedCents: number;
  purchaseCount: number;
  averageTicketCents: number;
  pendingCents: number;
  lastPurchaseAt: string | null;
  topProductName: string | null;
}

// Histórico básico do cliente (seção 8): agregado a partir das vendas dele.
// Consulta direta por customerId — eficiente, não varre a coleção inteira.
export async function getCustomerStats(customerId: string): Promise<CustomerStats> {
  const q = query(collection(db, "sales"), where("customerId", "==", customerId));
  const snapshot = await getDocs(q);
  const sales = snapshot.docs.map((d) => d.data() as RawSaleDoc);

  const totalPurchasedCents = sales.reduce((sum, s) => sum + s.totalCents, 0);
  const pendingCents = sales.reduce((sum, s) => sum + s.pendingCents, 0);
  const purchaseCount = sales.length;
  const averageTicketCents = purchaseCount > 0 ? Math.round(totalPurchasedCents / purchaseCount) : 0;

  let lastPurchaseAt: string | null = null;
  const productQuantities = new Map<string, number>();

  for (const sale of sales) {
    const saleDate = sale.createdAt?.toDate?.();
    if (saleDate && (!lastPurchaseAt || saleDate.toISOString() > lastPurchaseAt)) {
      lastPurchaseAt = saleDate.toISOString();
    }
    for (const item of sale.items ?? []) {
      productQuantities.set(
        item.productName,
        (productQuantities.get(item.productName) ?? 0) + item.quantity
      );
    }
  }

  let topProductName: string | null = null;
  let topQuantity = 0;
  for (const [name, qty] of productQuantities) {
    if (qty > topQuantity) {
      topQuantity = qty;
      topProductName = name;
    }
  }

  return {
    totalPurchasedCents,
    purchaseCount,
    averageTicketCents,
    pendingCents,
    lastPurchaseAt,
    topProductName,
  };
}

export interface ProductStats {
  quantitySold: number;
  revenueCents: number;
}

// Histórico básico do produto (seção 9). Sem um índice dedicado por produto,
// isso varre as vendas mais recentes — aceitável para o volume de uma
// confeitaria pequena; se o catálogo de vendas crescer muito, vale revisar
// (seção 28 — nunca fazer isso sem discutir antes, por ser mudança de arquitetura).
export async function getProductStats(productId: string): Promise<ProductStats> {
  const q = query(collection(db, "sales"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  let quantitySold = 0;
  let revenueCents = 0;

  for (const doc of snapshot.docs) {
    const sale = doc.data() as RawSaleDoc;
    for (const item of sale.items ?? []) {
      if (item.productId === productId) {
        quantitySold += item.quantity;
        revenueCents += item.totalCents;
      }
    }
  }

  return { quantitySold, revenueCents };
}
