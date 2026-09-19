import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "./config";
import { Order, OrderStatus, Payment, PaymentMethod, SaleItem } from "@/types";
import { logActivity } from "./activity";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

interface CreateOrderInput {
  customerId: string;
  customerName: string;
  items: SaleItem[];
  totalCents: number;
  expectedDate: string; // YYYY-MM-DD
  deliveryAddress?: string;
  notes?: string;
  status: OrderStatus;
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
    totalCents,
    expectedDate,
    deliveryAddress,
    notes,
    status,
    initialPaymentCents,
    initialPaymentMethod,
  } = input;

  if (items.length === 0) {
    throw new Error("A encomenda precisa ter ao menos um produto.");
  }
  if (initialPaymentCents > totalCents) {
    throw new Error("O valor pago não pode ser maior que o total da encomenda.");
  }

  const batch = writeBatch(db);
  const orderRef = doc(collection(db, "orders"));
  const pendingCents = totalCents - initialPaymentCents;
  const orderDate = new Date().toISOString().slice(0, 10);

  batch.set(orderRef, {
    customerId,
    customerName,
    items,
    totalCents,
    paidCents: initialPaymentCents,
    pendingCents,
    orderDate,
    expectedDate,
    deliveryAddress: deliveryAddress ?? "",
    notes: notes ?? "",
    status,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
  });

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
}

export async function listRecentOrders(max = 150): Promise<OrderListItem[]> {
  const q = query(collection(db, "orders"), orderBy("expectedDate", "asc"));
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
      status: data.status,
      itemsCount: Array.isArray(data.items) ? data.items.length : 0,
    };
  });
}

export async function getOrderWithPayments(orderId: string): Promise<Order | null> {
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
    items: data.items ?? [],
    totalCents: data.totalCents,
    paidCents: data.paidCents,
    pendingCents: data.pendingCents,
    orderDate: data.orderDate,
    expectedDate: data.expectedDate,
    salesDayId: data.salesDayId,
    deliveryAddress: data.deliveryAddress,
    notes: data.notes,
    status: data.status,
    payments,
  } as Order & { payments: Payment[] };
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

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error("Encomenda não encontrada.");
    }
    const order = orderSnap.data();
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
}

// Troca de status é uma correção local segura (seção 31) — não muda dinheiro
// nem estrutura, só o estágio operacional da encomenda.
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  await updateDoc(doc(db, "orders", orderId), { status });

  if (status === "cancelada") {
    await logActivity("pedido_cancelado", "Encomenda cancelada", orderId);
  }
}
