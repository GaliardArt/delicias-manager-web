import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "./config";
import { Order } from "@/types";
import { logActivity } from "./activity";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

export interface SalesDayDoc {
  id: string;
  date: string; // YYYY-MM-DD
  closed: boolean;
  createdAt: string;
  // Instantâneo gravado no fechamento (seção 15) — enquanto aberto, a tela usa
  // os totais calculados ao vivo a partir dos pedidos vinculados.
  expectedCents: number;
  receivedCents: number;
  pendingCents: number;
  cancelledCents: number;
  notRealizedCents: number;
  ordersCount: number;
}

// Busca (ou não) um Dia de Venda aberto para a data informada — usado tanto na
// criação quanto para vincular automaticamente novas encomendas dessa data.
export async function findOpenSalesDayByDate(date: string): Promise<SalesDayDoc | null> {
  const q = query(
    collection(db, "salesDays"),
    where("date", "==", date),
    where("closed", "==", false)
  );
  const snapshot = await getDocs(q);
  const d = snapshot.docs[0];
  if (!d) return null;
  return { id: d.id, ...(d.data() as Omit<SalesDayDoc, "id">) };
}

// Cria o Dia de Venda e vincula automaticamente as encomendas já existentes
// para essa data que ainda não pertenciam a nenhum outro Dia de Venda.
export async function createSalesDay(date: string): Promise<string> {
  const existing = await findOpenSalesDayByDate(date);
  if (existing) {
    throw new Error("Já existe um Dia de Venda aberto para essa data.");
  }

  const ordersSnap = await getDocs(
    query(collection(db, "orders"), where("expectedDate", "==", date))
  );
  const unlinkedOrderIds = ordersSnap.docs
    .filter((d) => !d.data().salesDayId)
    .map((d) => d.id);

  const batch = writeBatch(db);
  const dayRef = doc(collection(db, "salesDays"));

  batch.set(dayRef, {
    date,
    closed: false,
    expectedCents: 0,
    receivedCents: 0,
    pendingCents: 0,
    cancelledCents: 0,
    notRealizedCents: 0,
    ordersCount: unlinkedOrderIds.length,
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid ?? null,
  });

  for (const orderId of unlinkedOrderIds) {
    batch.update(doc(db, "orders", orderId), { salesDayId: dayRef.id });
  }

  const activityRef = doc(collection(db, "activityHistory"));
  batch.set(activityRef, {
    type: "dia_venda_criado",
    description: `Dia de Venda criado para ${new Date(date + "T00:00:00").toLocaleDateString(
      "pt-BR"
    )}`,
    referenceId: dayRef.id,
    userId: auth.currentUser?.uid ?? null,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return dayRef.id;
}

export async function listSalesDays(): Promise<SalesDayDoc[]> {
  const q = query(collection(db, "salesDays"), orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SalesDayDoc, "id" | "createdAt">),
    createdAt: tsToIso(d.data().createdAt),
  }));
}

export interface AddressGroup {
  address: string;
  orders: { customerName: string; itemsQuantity: number }[];
  totalQuantity: number;
}

export interface SalesDaySummary {
  ordersCount: number;
  expectedCents: number;
  receivedCents: number;
  pendingCents: number;
  fiadoCents: number;
  cancelledCount: number;
  cancelledCents: number;
  notRealizedCents: number;
}

export function summarizeOrders(orders: Order[]): SalesDaySummary {
  const active = orders.filter((o) => o.status !== "cancelada");
  const cancelled = orders.filter((o) => o.status === "cancelada");
  const notRealized = active.filter((o) => o.status !== "entregue");

  return {
    ordersCount: orders.length,
    expectedCents: active.reduce((sum, o) => sum + o.totalCents, 0),
    receivedCents: active.reduce((sum, o) => sum + o.paidCents, 0),
    pendingCents: active.reduce((sum, o) => sum + o.pendingCents, 0),
    fiadoCents: active.filter((o) => o.paidCents === 0).reduce((sum, o) => sum + o.totalCents, 0),
    cancelledCount: cancelled.length,
    cancelledCents: cancelled.reduce((sum, o) => sum + o.totalCents, 0),
    notRealizedCents: notRealized.reduce((sum, o) => sum + o.totalCents, 0),
  };
}

export function groupOrdersByAddress(orders: Order[]): AddressGroup[] {
  const active = orders.filter((o) => o.status !== "cancelada");
  const groups = new Map<string, AddressGroup>();

  for (const order of active) {
    const address = order.deliveryAddress?.trim() || "Sem endereço informado";
    const itemsQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
    if (!groups.has(address)) {
      groups.set(address, { address, orders: [], totalQuantity: 0 });
    }
    const group = groups.get(address)!;
    group.orders.push({ customerName: order.customerName, itemsQuantity });
    group.totalQuantity += itemsQuantity;
  }

  return Array.from(groups.values()).sort((a, b) => a.address.localeCompare(b.address));
}

export async function getSalesDayWithOrders(
  dayId: string
): Promise<{ day: SalesDayDoc; orders: Order[] } | null> {
  const daySnap = await getDoc(doc(db, "salesDays", dayId));
  if (!daySnap.exists()) return null;

  const ordersSnap = await getDocs(
    query(collection(db, "orders"), where("salesDayId", "==", dayId))
  );
  const orders: Order[] = ordersSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      customerId: data.customerId,
      customerName: data.customerName,
      items: data.items ?? [],
      totalCents: data.totalCents,
      paidCents: data.paidCents,
      pendingCents: data.pendingCents,
      payments: [],
      orderDate: data.orderDate,
      expectedDate: data.expectedDate,
      salesDayId: data.salesDayId,
      deliveryAddress: data.deliveryAddress,
      notes: data.notes,
      status: data.status,
    };
  });

  return {
    day: { id: daySnap.id, ...(daySnap.data() as Omit<SalesDayDoc, "id" | "createdAt">), createdAt: tsToIso(daySnap.data().createdAt) },
    orders,
  };
}

// Fechamento (seção 15): grava o instantâneo dos totais calculados a partir dos
// pedidos vinculados naquele momento. Não altera os pedidos em si — cada valor
// continua rastreável até sua origem, nunca vira um número agregado sem lastro.
export async function closeSalesDay(dayId: string, summary: SalesDaySummary): Promise<void> {
  await updateDoc(doc(db, "salesDays", dayId), {
    closed: true,
    expectedCents: summary.expectedCents,
    receivedCents: summary.receivedCents,
    pendingCents: summary.pendingCents,
    cancelledCents: summary.cancelledCents,
    notRealizedCents: summary.notRealizedCents,
    ordersCount: summary.ordersCount,
  });
  await logActivity("dia_venda_encerrado", "Dia de Venda encerrado", dayId);
}
