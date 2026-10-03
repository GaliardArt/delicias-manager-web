import {
  collection,
  DocumentData,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  QueryDocumentSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  writeBatch,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "./config";
import { Payment, PaymentMethod, Sale, SaleItem } from "@/types";
import { normalizeSaleItems } from "@/lib/utils/normalize-items";
import { ensureOpenSalesDay } from "./sales-days";
import { todayLocalIso } from "@/lib/utils/format";
import { readThroughCache, updateReadCache } from "./read-cache";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

interface CreateSaleInput {
  customerId: string;
  customerName: string;
  items: SaleItem[];
  discountCents: number;
  /** Pagamento já recebido no ato da venda (0 para fiado total). */
  initialPaymentCents: number;
  initialPaymentMethod: PaymentMethod;
}

// Cria a venda e, se houver valor pago no ato, o primeiro pagamento — tudo em
// um único batch atômico, para nunca deixar uma venda "pela metade" (seção 21).
// customerId pode vir vazio para vendas avulsas (cliente não cadastrado).
export async function createSale(input: CreateSaleInput): Promise<string> {
  const {
    customerId,
    customerName,
    items,
    discountCents,
    initialPaymentCents,
    initialPaymentMethod,
  } = input;

  if (items.length === 0) {
    throw new Error("A venda precisa ter ao menos um produto.");
  }
  if (!Number.isInteger(discountCents) || discountCents < 0) {
    throw new Error("O desconto da venda é inválido.");
  }

  const normalizedItems = items.map((item) => ({
    ...item,
    totalCents: Math.round(item.unitPriceCents * item.quantity),
  }));
  const subtotalCents = normalizedItems.reduce((sum, item) => sum + item.totalCents, 0);

  if (discountCents > subtotalCents) {
    throw new Error("O desconto não pode ser maior que o subtotal da venda.");
  }

  const totalCents = subtotalCents - discountCents;

  if (initialPaymentCents > totalCents) {
    throw new Error("O valor pago não pode ser maior que o total da venda.");
  }

  await ensureOpenSalesDay(todayLocalIso());

  const batch = writeBatch(db);
  const saleRef = doc(collection(db, "sales"));
  const pendingCents = totalCents - initialPaymentCents;

  batch.set(saleRef, {
    customerId,
    customerName,
    items: normalizedItems,
    subtotalCents,
    discountCents,
    totalCents,
    paidCents: initialPaymentCents,
    pendingCents,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
  });

  // Baixa de estoque (seção pedida: aceitar o pedido mesmo com estoque zerado,
  // só deixa negativo — nunca bloqueia a venda).
  for (const item of items) {
    batch.update(doc(db, "products", item.productId), {
      stockQuantity: increment(-item.quantity),
    });
  }

  if (initialPaymentCents > 0) {
    const paymentRef = doc(collection(saleRef, "payments"));
    batch.set(paymentRef, {
      amountCents: initialPaymentCents,
      method: initialPaymentMethod,
      paidAt: serverTimestamp(),
    });
  }

  const activityRef = doc(collection(db, "activityHistory"));
  batch.set(activityRef, {
    type: "venda_criada",
    description: `Venda registrada para ${customerName}`,
    referenceId: saleRef.id,
    userId: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return saleRef.id;
}

export interface SaleListItem {
  id: string;
  customerName: string;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  createdAt: string;
  itemsCount: number;
}

export interface UpdateSaleInput {
  customerId: string;
  customerName: string;
  items: SaleItem[];
  discountCents: number;
  payments: Payment[];
}

function getSaleTotals(items: SaleItem[], discountCents: number) {
  if (!items.length) throw new Error("A venda precisa ter ao menos um produto.");
  if (!Number.isInteger(discountCents) || discountCents < 0) {
    throw new Error("O desconto da venda é inválido.");
  }
  const normalizedItems = items.map((item) => ({
    ...item,
    totalCents: Math.round(item.unitPriceCents * item.quantity),
  }));
  const subtotalCents = normalizedItems.reduce((sum, item) => sum + item.totalCents, 0);
  if (discountCents > subtotalCents) {
    throw new Error("O desconto não pode ser maior que o subtotal da venda.");
  }
  return { normalizedItems, subtotalCents, totalCents: subtotalCents - discountCents };
}

function quantityByProduct(items: SaleItem[]): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return quantities;
}

/** Edits sale details without changing its payment history or original date. */
export async function updateSale(saleId: string, input: UpdateSaleInput): Promise<Sale> {
  const { normalizedItems, subtotalCents, totalCents } = getSaleTotals(input.items, input.discountCents);
  const saleRef = doc(db, "sales", saleId);
  let updatedSale!: Sale;

  await runTransaction(db, async (transaction) => {
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Venda não encontrada.");
    const current = saleSnap.data();
    const currentItems = normalizeSaleItems(current.items);
    const paidCents = Number(current.paidCents ?? 0);
    if (totalCents < paidCents) {
      throw new Error("O total não pode ficar abaixo do valor já pago. Ajuste os itens ou o desconto.");
    }

    const oldQuantities = quantityByProduct(currentItems);
    const newQuantities = quantityByProduct(normalizedItems);
    const productIds = new Set([...oldQuantities.keys(), ...newQuantities.keys()]);
    const productDeltas = Array.from(productIds)
      .map((id) => ({ id, quantity: (oldQuantities.get(id) ?? 0) - (newQuantities.get(id) ?? 0) }))
      .filter((entry) => entry.quantity !== 0);
    const productRefs = productDeltas.map(({ id }) => doc(db, "products", id));
    const dayRef = typeof current.salesDayId === "string" ? doc(db, "salesDays", current.salesDayId) : null;
    const actualDaySnap = dayRef ? await transaction.get(dayRef) : null;
    const actualProductSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));

    productDeltas.forEach(({ id, quantity }, index) => {
      const productSnap = actualProductSnaps[index];
      if (quantity < 0 && !productSnap?.exists()) {
        throw new Error("Um produto adicionado à venda não existe mais.");
      }
    });

    transaction.update(saleRef, {
      customerId: input.customerId,
      customerName: input.customerName,
      items: normalizedItems,
      subtotalCents,
      discountCents: input.discountCents,
      totalCents,
      pendingCents: totalCents - paidCents,
    });
    productDeltas.forEach(({ quantity }, index) => {
      const productRef = productRefs[index];
      if (productRef && actualProductSnaps[index]?.exists()) {
        transaction.update(productRef, { stockQuantity: increment(quantity) });
      }
    });

    if (actualDaySnap?.exists() && actualDaySnap.data().closed === true) {
      const totalDelta = totalCents - Number(current.totalCents ?? 0);
      const pendingDelta = totalCents - paidCents - Number(current.pendingCents ?? (Number(current.totalCents ?? 0) - paidCents));
      transaction.update(dayRef!, {
        expectedCents: increment(totalDelta),
        pendingCents: increment(pendingDelta),
        salesCents: increment(totalDelta),
      });
    }

    updatedSale = {
      id: saleSnap.id,
      customerId: input.customerId,
      customerName: input.customerName,
      items: normalizedItems,
      subtotalCents,
      discountCents: input.discountCents,
      totalCents,
      paidCents,
      pendingCents: totalCents - paidCents,
      payments: input.payments,
      salesDayId: current.salesDayId,
      createdAt: tsToIso(current.createdAt),
    };
  });

  updateReadCache<Sale>(`sales/${saleId}/detail`, (current) => ({ ...updatedSale, payments: current.payments }));
  for (const key of ["sales/recent/100", "sales/history/150"]) {
    updateReadCache<SaleListItem[]>(key, (sales) => sales.map((sale) => sale.id === saleId ? {
      ...sale,
      customerName: updatedSale.customerName,
      totalCents: updatedSale.totalCents,
      paidCents: updatedSale.paidCents,
      pendingCents: updatedSale.pendingCents,
      itemsCount: updatedSale.items.length,
    } : sale));
  }
  return updatedSale;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getSalesForList(
  max: number,
  mode: "recent" | "historical"
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  if (max <= 0) return [];

  const closedDaysSnap = await getDocs(
    query(collection(db, "salesDays"), where("closed", "==", true))
  );
  const closedDayIds = new Set(closedDaysSnap.docs.map((d) => d.id));
  const closedDates = new Set(
    closedDaysSnap.docs.map((d) => d.data().date as string)
  );
  const batchSize = Math.min(Math.max(max, 25), 100);
  const matches: QueryDocumentSnapshot<DocumentData>[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;

  while (matches.length < max) {
    const salesQuery = cursor
      ? query(
          collection(db, "sales"),
          orderBy("createdAt", "desc"),
          startAfter(cursor),
          limit(batchSize)
        )
      : query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(batchSize));
    const snapshot = await getDocs(salesQuery);
    if (snapshot.empty) break;

    for (const saleDoc of snapshot.docs) {
      const data = saleDoc.data();
      const saleDate =
        data.createdAt instanceof Timestamp ? localDateKey(data.createdAt.toDate()) : null;
      const isClosed =
        mode === "recent"
          ? saleDate !== null && closedDates.has(saleDate)
          : data.salesDayId
            ? closedDayIds.has(String(data.salesDayId))
            : saleDate !== null && closedDates.has(saleDate);

      if ((mode === "recent" && !isClosed) || (mode === "historical" && isClosed)) {
        matches.push(saleDoc);
        if (matches.length >= max) break;
      }
    }

    cursor = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < batchSize) break;
  }

  return matches;
}

// Lista as vendas mais recentes. Filtros mais elaborados (período, forma de
// pagamento) ficam para quando houver necessidade real de escalar (seção 28).
export async function listRecentSales(max = 100): Promise<SaleListItem[]> {
  return readThroughCache(`sales/recent/${max}`, async () => {
  const sales = await getSalesForList(max, "recent");
  return sales.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      customerName: data.customerName,
      totalCents: data.totalCents,
      paidCents: data.paidCents,
      pendingCents: data.pendingCents,
      createdAt: tsToIso(data.createdAt),
      itemsCount: Array.isArray(data.items) ? data.items.length : 0,
    };
  });
  });
}

export async function listHistoricalSales(max = 150): Promise<SaleListItem[]> {
  return readThroughCache(`sales/history/${max}`, async () => {
  const sales = await getSalesForList(max, "historical");
  return sales.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      customerName: data.customerName,
      totalCents: data.totalCents,
      paidCents: data.paidCents,
      pendingCents: data.pendingCents,
      createdAt: tsToIso(data.createdAt),
      itemsCount: Array.isArray(data.items) ? data.items.length : 0,
    };
  });
  });
}

export async function getSaleWithPayments(saleId: string): Promise<Sale | null> {
  return readThroughCache(`sales/${saleId}/detail`, async () => {
  const saleSnap = await getDoc(doc(db, "sales", saleId));
  if (!saleSnap.exists()) return null;
  const data = saleSnap.data();

  const paymentsSnap = await getDocs(
    query(collection(db, "sales", saleId, "payments"), orderBy("paidAt", "asc"))
  );
  const payments: Payment[] = paymentsSnap.docs.map((p) => {
    const pd = p.data();
    return {
      id: p.id,
      amountCents: pd.amountCents,
      method: pd.method,
      paidAt: tsToIso(pd.paidAt),
      notes: pd.notes,
    };
  });

  const normalizedItems = normalizeSaleItems(data.items);
  const fallbackSubtotalCents = normalizedItems.reduce(
    (sum, item) => sum + item.totalCents,
    0
  );

  return {
    id: saleSnap.id,
    customerId: data.customerId,
    customerName: data.customerName,
    items: normalizedItems,
    subtotalCents: Number(data.subtotalCents ?? fallbackSubtotalCents),
    discountCents: Number(data.discountCents ?? 0),
    totalCents: Number(data.totalCents ?? fallbackSubtotalCents),
    paidCents: Number(data.paidCents ?? 0),
    pendingCents: data.pendingCents,
    payments,
    salesDayId: data.salesDayId,
    createdAt: tsToIso(data.createdAt),
  };
  });
}

// Registra um novo pagamento sobre uma venda já existente (fiado quitado
// depois, pagamento parcial complementado, etc). Roda em transação para que
// paidCents/pendingCents nunca fiquem inconsistentes com a soma real dos
// pagamentos, mesmo com dois usuários registrando ao mesmo tempo.
export async function deleteSale(saleId: string): Promise<void> {
  const saleRef = doc(db, "sales", saleId);
  const saleSnap = await getDoc(saleRef);
  if (!saleSnap.exists()) throw new Error("Venda não encontrada.");

  const sale = saleSnap.data();
  const paymentsSnap = await getDocs(collection(saleRef, "payments"));
  const batch = writeBatch(db);

  for (const payment of paymentsSnap.docs) {
    batch.delete(payment.ref);
  }

  if (sale.salesDayId) {
    const dayRef = doc(db, "salesDays", sale.salesDayId);
    batch.update(dayRef, {
      expectedCents: increment(-Number(sale.totalCents ?? 0)),
      receivedCents: increment(-Number(sale.paidCents ?? 0)),
      pendingCents: increment(-Number(sale.pendingCents ?? 0)),
      salesCents: increment(-Number(sale.totalCents ?? 0)),
      salesReceivedCents: increment(-Number(sale.paidCents ?? 0)),
      salesCount: increment(-1),
    });
  } else {
    const createdAt = sale.createdAt instanceof Timestamp ? sale.createdAt.toDate() : null;
    if (createdAt) {
      const date = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(
        createdAt.getDate()
      ).padStart(2, "0")}`;
      const daysSnap = await getDocs(
        query(collection(db, "salesDays"), where("date", "==", date))
      );
      const dayDoc = daysSnap.docs[0];
      if (dayDoc) {
        const dayRef = dayDoc.ref;
        batch.update(dayRef, {
          expectedCents: increment(-Number(sale.totalCents ?? 0)),
          receivedCents: increment(-Number(sale.paidCents ?? 0)),
          pendingCents: increment(-Number(sale.pendingCents ?? 0)),
          salesCents: increment(-Number(sale.totalCents ?? 0)),
          salesReceivedCents: increment(-Number(sale.paidCents ?? 0)),
          salesCount: increment(-1),
        });
      }
    }
  }

  batch.delete(saleRef);
  await batch.commit();
}

export async function addPayment(
  saleId: string,
  amountCents: number,
  method: PaymentMethod
): Promise<void> {
  let closedSalesDayId: string | undefined;

  if (amountCents <= 0) {
    throw new Error("O valor do pagamento precisa ser maior que zero.");
  }

  await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) {
      throw new Error("Venda não encontrada.");
    }
    const sale = saleSnap.data();
    closedSalesDayId = sale.salesDayId as string | undefined;
    const currentPaid: number = sale.paidCents;
    const total: number = sale.totalCents;
    const newPaid = currentPaid + amountCents;

    if (newPaid > total) {
      throw new Error("Esse pagamento deixaria o valor pago maior que o total da venda.");
    }

    const paymentRef = doc(collection(saleRef, "payments"));
    transaction.set(paymentRef, {
      amountCents,
      method,
      paidAt: serverTimestamp(),
    });

    transaction.update(saleRef, {
      paidCents: newPaid,
      pendingCents: total - newPaid,
    });

    const activityRef = doc(collection(db, "activityHistory"));
    transaction.set(activityRef, {
      type: "pagamento_recebido",
      description: `Pagamento de ${(amountCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })} recebido de ${sale.customerName}`,
      referenceId: saleId,
      userId: auth.currentUser?.uid ?? null,
      createdAt: serverTimestamp(),
    });
  });

  if (closedSalesDayId) {
    await updateDoc(doc(db, "salesDays", closedSalesDayId), {
      receivedCents: increment(amountCents),
      pendingCents: increment(-amountCents),
      salesReceivedCents: increment(amountCents),
    });
  }
}
