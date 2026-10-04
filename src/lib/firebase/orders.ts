import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "./config";
import { Order, OrderStatus, Payment, PaymentMethod, SaleItem } from "@/types";
import { logActivity } from "./activity";
import { normalizeSaleItems } from "@/lib/utils/normalize-items";
import { todayLocalIso } from "@/lib/utils/format";
import { normalizeOrderStatus } from "@/lib/utils/order-status";
import { ensureOpenSalesDay, updateOpenDayOrderDateCache } from "./sales-days";
import { readThroughCache, updateReadCache } from "./read-cache";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

interface CreateOrderInput {
  customerId: string;
  customerName: string;
  items: SaleItem[];
  expectedDate: string; // YYYY-MM-DD
  deliveryAddress?: string;
  notes?: string;
  /** Sinal/depósito pago no ato do cadastro (0 se nada pago ainda). */
  initialPaymentCents: number;
  initialPaymentMethod: PaymentMethod;
}

// Cria a encomenda e, se houver sinal/depósito, o primeiro pagamento — em um
// único batch atômico, seguindo a mesma regra de integridade das vendas (seção 21).
export async function createOrder(input: CreateOrderInput): Promise<string> {
  const {
    customerId,
    customerName,
    items,
    expectedDate,
    deliveryAddress,
    notes,
    initialPaymentCents,
    initialPaymentMethod,
  } = input;

  if (items.length === 0) {
    throw new Error("A encomenda precisa ter ao menos um produto.");
  }

  const normalizedItems = items.map((item) => ({
    ...item,
    totalCents: Math.round(item.unitPriceCents * item.quantity),
  }));
  const totalCents = normalizedItems.reduce((sum, item) => sum + item.totalCents, 0);

  if (initialPaymentCents > totalCents) {
    throw new Error("O valor pago não pode ser maior que o total da encomenda.");
  }

  const salesDayId = await ensureOpenSalesDay(expectedDate);

  const batch = writeBatch(db);
  const orderRef = doc(collection(db, "orders"));
  const pendingCents = totalCents - initialPaymentCents;
  const orderDate = todayLocalIso();

  batch.set(orderRef, {
    customerId,
    customerName,
    items: normalizedItems,
    totalCents,
    paidCents: initialPaymentCents,
    pendingCents,
    orderDate,
    expectedDate,
    salesDayId,
    deliveryAddress: deliveryAddress ?? "",
    notes: notes ?? "",
    status: "em_producao",
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
  });

  // Baixa de estoque também para encomendas — aceita mesmo com estoque
  // zerado, só deixa negativo.
  for (const item of items) {
    batch.update(doc(db, "products", item.productId), {
      stockQuantity: increment(-item.quantity),
    });
  }

  if (initialPaymentCents > 0) {
    const paymentRef = doc(collection(orderRef, "payments"));
    batch.set(paymentRef, {
      amountCents: initialPaymentCents,
      method: initialPaymentMethod,
      paidAt: serverTimestamp(),
    });
  }

  const activityRef = doc(collection(db, "activityHistory"));
  batch.set(activityRef, {
    type: "encomenda_criada",
    description: `Nova encomenda de ${customerName} para ${new Date(
      expectedDate + "T00:00:00"
    ).toLocaleDateString("pt-BR")}`,
    referenceId: orderRef.id,
    userId: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return orderRef.id;
}

export interface OrderListItem {
  id: string;
  customerName: string;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  expectedDate: string;
  status: OrderStatus;
  itemsCount: number;
  items: SaleItem[];
}

// "Finalizada" representa somente a entrega/conclusão operacional.
// Pagamento é controlado separadamente por paidCents/pendingCents.
export function isOrderCompleted(order: Pick<OrderListItem, "status">): boolean {
  return order.status === "finalizada";
}

export async function listRecentOrders(max = 150): Promise<OrderListItem[]> {
  return readThroughCache(`orders/recent/${max}`, async () => {
  const q = query(
    collection(db, "orders"),
    orderBy("expectedDate", "asc"),
    limit(max)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, max).map((d) => {
    const data = d.data();
    return {
      id: d.id,
      customerName: data.customerName,
      totalCents: data.totalCents,
      paidCents: data.paidCents,
      pendingCents: data.pendingCents,
      expectedDate: data.expectedDate,
      status: normalizeOrderStatus(data.status),
      itemsCount: Array.isArray(data.items) ? data.items.length : 0,
      items: normalizeSaleItems(data.items),
    };
  });
  });
}

export interface UpdateOrderInput {
  customerId: string;
  customerName: string;
  items: SaleItem[];
  expectedDate: string;
  deliveryAddress?: string;
  notes?: string;
  payments: Payment[];
}

function quantitiesByProduct(items: SaleItem[]): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const item of items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  return quantities;
}

/** Updates order details while preserving its payment history and original date. */
export async function updateOrder(orderId: string, input: UpdateOrderInput): Promise<Order> {
  if (!input.expectedDate) throw new Error("Informe a data prevista de entrega.");
  if (!input.items.length) throw new Error("A encomenda precisa ter ao menos um produto.");
  const items = input.items.map((item) => ({ ...item, totalCents: Math.round(item.unitPriceCents * item.quantity) }));
  const totalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) throw new Error("Encomenda não encontrada.");
  const initialData = orderSnap.data();
  if (normalizeOrderStatus(initialData.status) === "cancelada") {
    throw new Error("Não é possível editar uma encomenda cancelada.");
  }
  if (totalCents < Number(initialData.paidCents ?? 0)) {
    throw new Error("O total não pode ficar abaixo do valor já pago. Ajuste os itens.");
  }
  const targetSalesDayId = input.expectedDate !== initialData.expectedDate
    ? await ensureOpenSalesDay(input.expectedDate)
    : (typeof initialData.salesDayId === "string" ? initialData.salesDayId : undefined);
  let updatedOrder!: Order;

  await runTransaction(db, async (transaction) => {
    const currentSnap = await transaction.get(orderRef);
    if (!currentSnap.exists()) throw new Error("Encomenda não encontrada.");
    const current = currentSnap.data();
    const currentStatus = normalizeOrderStatus(current.status);
    if (currentStatus === "cancelada") throw new Error("Não é possível editar uma encomenda cancelada.");
    const currentItems = normalizeSaleItems(current.items);
    const paidCents = Number(current.paidCents ?? 0);
    if (totalCents < paidCents) {
      throw new Error("O total não pode ficar abaixo do valor já pago. Ajuste os itens.");
    }

    const oldQuantities = quantitiesByProduct(currentItems);
    const newQuantities = quantitiesByProduct(items);
    const productIds = new Set([...oldQuantities.keys(), ...newQuantities.keys()]);
    const productDeltas = Array.from(productIds)
      .map((id) => ({ id, quantity: (oldQuantities.get(id) ?? 0) - (newQuantities.get(id) ?? 0) }))
      .filter((entry) => entry.quantity !== 0);
    const productRefs = productDeltas.map(({ id }) => doc(db, "products", id));
    const oldDayRef = typeof current.salesDayId === "string" ? doc(db, "salesDays", current.salesDayId) : null;
    const newDayRef = targetSalesDayId && targetSalesDayId !== current.salesDayId
      ? doc(db, "salesDays", targetSalesDayId)
      : null;
    const dayRefs = [oldDayRef, newDayRef].filter((ref): ref is NonNullable<typeof ref> => ref !== null);
    const daySnaps = await Promise.all(dayRefs.map((ref) => transaction.get(ref)));
    const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
    productDeltas.forEach(({ quantity }, index) => {
      if (quantity < 0 && (!productSnaps[index] || !productSnaps[index].exists())) {
        throw new Error("Um produto adicionado à encomenda não existe mais.");
      }
    });
    const oldDaySnap = oldDayRef ? daySnaps[dayRefs.indexOf(oldDayRef)] : undefined;
    const newDaySnap = newDayRef ? daySnaps[dayRefs.indexOf(newDayRef)] : undefined;
    if (newDaySnap?.exists() && newDaySnap.data().closed === true) {
      throw new Error("A nova data já pertence a um Dia de Venda encerrado.");
    }

    transaction.update(orderRef, {
      customerId: input.customerId,
      customerName: input.customerName,
      items,
      totalCents,
      pendingCents: totalCents - paidCents,
      expectedDate: input.expectedDate,
      salesDayId: targetSalesDayId ?? null,
      deliveryAddress: input.deliveryAddress ?? "",
      notes: input.notes ?? "",
    });
    productDeltas.forEach(({ quantity }, index) => {
      const productRef = productRefs[index];
      if (productRef && productSnaps[index]?.exists()) {
        transaction.update(productRef, { stockQuantity: increment(quantity) });
      }
    });

    if (oldDaySnap?.exists() && oldDaySnap.data().closed === true) {
      const oldTotal = Number(current.totalCents ?? 0);
      const oldPending = Number(current.pendingCents ?? (oldTotal - paidCents));
      if (newDayRef) {
        transaction.update(oldDayRef!, {
          expectedCents: increment(-oldTotal),
          receivedCents: increment(-paidCents),
          pendingCents: increment(-oldPending),
          ordersCount: increment(-1),
          ...(currentStatus === "em_producao" ? { notRealizedCents: increment(-oldTotal) } : {}),
        });
      } else {
        const totalDelta = totalCents - oldTotal;
        transaction.update(oldDayRef!, {
          expectedCents: increment(totalDelta),
          pendingCents: increment(totalCents - paidCents - oldPending),
          ...(currentStatus === "em_producao" ? { notRealizedCents: increment(totalDelta) } : {}),
        });
      }
    }

    updatedOrder = {
      id: currentSnap.id,
      customerId: input.customerId,
      customerName: input.customerName,
      items,
      totalCents,
      paidCents,
      pendingCents: totalCents - paidCents,
      payments: input.payments,
      orderDate: current.orderDate,
      expectedDate: input.expectedDate,
      salesDayId: targetSalesDayId,
      deliveryAddress: input.deliveryAddress ?? "",
      notes: input.notes ?? "",
      status: currentStatus,
    };
  });

  updateReadCache<Order>(`orders/${orderId}/detail`, (current) => ({ ...updatedOrder, payments: current.payments }));
  updateReadCache<OrderListItem[]>("orders/recent/150", (orders) => orders.map((order) => order.id === orderId ? {
    ...order,
    customerName: updatedOrder.customerName,
    totalCents: updatedOrder.totalCents,
    paidCents: updatedOrder.paidCents,
    pendingCents: updatedOrder.pendingCents,
    expectedDate: updatedOrder.expectedDate,
    status: updatedOrder.status,
    itemsCount: updatedOrder.items.length,
    items: updatedOrder.items,
  } : order).sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)));
  return updatedOrder;
}

/** Moves an open order to another delivery date without changing its contents. */
export async function rescheduleOrder(
  orderId: string,
  currentExpectedDate: string,
  newExpectedDate: string
): Promise<string> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newExpectedDate)) {
    throw new Error("Informe uma data válida para a entrega.");
  }
  if (newExpectedDate === currentExpectedDate) return "";

  const newSalesDayId = await ensureOpenSalesDay(newExpectedDate);
  const orderRef = doc(db, "orders", orderId);
  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Encomenda não encontrada.");
    const order = orderSnap.data();
    if (order.expectedDate !== currentExpectedDate) {
      throw new Error("A data desta encomenda foi alterada por outra operação. Atualize e tente novamente.");
    }
    if (normalizeOrderStatus(order.status) !== "em_producao") {
      throw new Error("Somente encomendas em produção podem ser redirecionadas.");
    }

    const oldDayRef = typeof order.salesDayId === "string" ? doc(db, "salesDays", order.salesDayId) : null;
    const newDayRef = doc(db, "salesDays", newSalesDayId);
    const oldDaySnap = oldDayRef ? await transaction.get(oldDayRef) : null;
    const newDaySnap = await transaction.get(newDayRef);
    if (!newDaySnap.exists() || newDaySnap.data().closed === true) {
      throw new Error("A nova data pertence a um Dia de Venda encerrado. Escolha outra data.");
    }

    transaction.update(orderRef, {
      expectedDate: newExpectedDate,
      salesDayId: newSalesDayId,
    });

    if (oldDayRef && oldDaySnap?.exists() && oldDaySnap.data().closed === true) {
      const totalCents = Number(order.totalCents ?? 0);
      const paidCents = Number(order.paidCents ?? 0);
      const pendingCents = Number(order.pendingCents ?? (totalCents - paidCents));
      transaction.update(oldDayRef, {
        expectedCents: increment(-totalCents),
        receivedCents: increment(-paidCents),
        pendingCents: increment(-pendingCents),
        ordersCount: increment(-1),
        notRealizedCents: increment(-totalCents),
      });
    }
  });

  updateReadCache<Order>(`orders/${orderId}/detail`, (order) => ({
    ...order,
    expectedDate: newExpectedDate,
    salesDayId: newSalesDayId,
  }));
  updateReadCache<OrderListItem[]>("orders/recent/150", (orders) => orders
    .map((order) => order.id === orderId ? { ...order, expectedDate: newExpectedDate } : order)
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)));
  updateOpenDayOrderDateCache(orderId, newExpectedDate, newSalesDayId);
  return newSalesDayId;
}

/** Marks an order delivered; closing its sales day remains a separate action. */
export async function markOrderDelivered(orderId: string): Promise<void> {
  const orderRef = doc(db, "orders", orderId);
  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) throw new Error("Encomenda não encontrada.");
    const status = normalizeOrderStatus(orderSnap.data().status);
    if (status === "cancelada") throw new Error("Uma encomenda cancelada não pode ser marcada como entregue.");
    if (status !== "finalizada") transaction.update(orderRef, { status: "finalizada" });
  });

  updateReadCache<OrderListItem[]>("orders/recent/150", (orders) => orders.map((order) =>
    order.id === orderId ? { ...order, status: "finalizada" } : order
  ));
  updateReadCache<Order>(`orders/${orderId}/detail`, (order) => ({ ...order, status: "finalizada" }));
}

export async function getOrderWithPayments(orderId: string): Promise<Order | null> {
  return readThroughCache(`orders/${orderId}/detail`, async () => {
  const orderSnap = await getDoc(doc(db, "orders", orderId));
  if (!orderSnap.exists()) return null;
  const data = orderSnap.data();

  const paymentsSnap = await getDocs(
    query(collection(db, "orders", orderId, "payments"), orderBy("paidAt", "asc"))
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

  return {
    id: orderSnap.id,
    customerId: data.customerId,
    customerName: data.customerName,
    items: normalizeSaleItems(data.items),
    totalCents: data.totalCents,
    paidCents: data.paidCents,
    pendingCents: data.pendingCents,
    orderDate: data.orderDate,
    expectedDate: data.expectedDate,
    salesDayId: data.salesDayId,
    deliveryAddress: data.deliveryAddress,
    notes: data.notes,
    status: normalizeOrderStatus(data.status),
    payments,
  } as Order & { payments: Payment[] };
  });
}

// Mesma lógica transacional da Fase 3: nunca deixa paidCents ultrapassar o total,
// mesmo com dois usuários registrando pagamento ao mesmo tempo.
export async function addOrderPayment(
  orderId: string,
  amountCents: number,
  method: PaymentMethod
): Promise<void> {
  if (amountCents <= 0) {
    throw new Error("O valor do pagamento precisa ser maior que zero.");
  }

  let salesDayId: string | undefined;
  let expectedDate: string | undefined;

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error("Encomenda não encontrada.");
    }
    const order = orderSnap.data();
    salesDayId = typeof order.salesDayId === "string" ? order.salesDayId : undefined;
    expectedDate = typeof order.expectedDate === "string" ? order.expectedDate : undefined;
    const currentPaid: number = order.paidCents;
    const total: number = order.totalCents;
    const newPaid = currentPaid + amountCents;

    if (newPaid > total) {
      throw new Error("Esse pagamento deixaria o valor pago maior que o total da encomenda.");
    }

    const paymentRef = doc(collection(orderRef, "payments"));
    transaction.set(paymentRef, {
      amountCents,
      method,
      paidAt: serverTimestamp(),
    });

    transaction.update(orderRef, {
      paidCents: newPaid,
      pendingCents: total - newPaid,
    });

    const activityRef = doc(collection(db, "activityHistory"));
    transaction.set(activityRef, {
      type: "pagamento_recebido",
      description: `Pagamento de ${(amountCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })} recebido de ${order.customerName} (encomenda)`,
      referenceId: orderId,
      userId: auth.currentUser?.uid ?? null,
      createdAt: serverTimestamp(),
    });
  });

  if (salesDayId) {
    await updateDoc(doc(db, "salesDays", salesDayId), {
      receivedCents: increment(amountCents),
      pendingCents: increment(-amountCents),
    });
  } else if (expectedDate) {
    const daysSnap = await getDocs(
      query(collection(db, "salesDays"), where("date", "==", expectedDate))
    );
    const dayDoc = daysSnap.docs[0];
    if (dayDoc) {
      await updateDoc(dayDoc.ref, {
        receivedCents: increment(amountCents),
        pendingCents: increment(-amountCents),
      });
    }
  }
}

// Exclui a encomenda e seus pagamentos. Se ela já pertence a um Dia de Venda
// encerrado, os totais históricos daquele dia também são ajustados.
export async function deleteOrder(orderId: string): Promise<void> {
  const orderRef = doc(db, "orders", orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) throw new Error("Encomenda não encontrada.");

  const order = orderSnap.data();
  const paymentsSnap = await getDocs(collection(orderRef, "payments"));
  const batch = writeBatch(db);

  for (const payment of paymentsSnap.docs) {
    batch.delete(payment.ref);
  }

  let dayRef =
    typeof order.salesDayId === "string"
      ? doc(db, "salesDays", order.salesDayId)
      : null;
  if (!dayRef) {
    const daysSnap = await getDocs(
      query(collection(db, "salesDays"), where("date", "==", order.expectedDate))
    );
    dayRef = daysSnap.docs[0]?.ref ?? null;
  }
  if (dayRef && order.status !== "cancelada") {
    batch.update(dayRef, {
      expectedCents: increment(-Number(order.totalCents ?? 0)),
      receivedCents: increment(-Number(order.paidCents ?? 0)),
      pendingCents: increment(-Number(order.pendingCents ?? 0)),
      ordersCount: increment(-1),
    });
  }

  batch.delete(orderRef);
  await batch.commit();
}

// O fechamento do Dia de Venda é a operação que finaliza uma encomenda.
// Cancelamento continua disponível enquanto ela ainda não foi finalizada.
export async function cancelOrder(orderId: string): Promise<void> {
  const orderRef = doc(db, "orders", orderId);

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error("Encomenda não encontrada.");
    }

    const order = orderSnap.data();
    if (normalizeOrderStatus(order.status) === "finalizada") {
      throw new Error("Uma encomenda finalizada não pode ser cancelada.");
    }

    transaction.update(orderRef, { status: "cancelada" });
  });

  await logActivity("pedido_cancelado", "Encomenda cancelada", orderId);
}

// Resumo de produção para o WhatsApp (seção 17): cliente + produtos a produzir,
// agrupado por data prevista de entrega. Só entram encomendas ainda em aberto
// (não canceladas, não concluídas) — a lista é para quem vai produzir, não um
// relatório financeiro.
export function buildProductionWhatsAppText(orders: OrderListItem[]): string {
  const relevant = orders
    .filter((o) => o.status !== "cancelada" && !isOrderCompleted(o))
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  const lines = [`📦 *Produção pendente*`];

  if (relevant.length === 0) {
    lines.push(``, `Nenhuma encomenda em aberto no momento.`);
    return lines.join("\n");
  }

  let lastDate = "";
  for (const order of relevant) {
    if (order.expectedDate !== lastDate) {
      lastDate = order.expectedDate;
      const label = new Date(order.expectedDate + "T00:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      lines.push(``, `📅 *${label}*`);
    }
    lines.push(`👤 ${order.customerName}`);
    for (const item of order.items) {
      lines.push(`   • ${item.quantity}x ${item.productName}`);
    }
  }

  return lines.join("\n");
}
