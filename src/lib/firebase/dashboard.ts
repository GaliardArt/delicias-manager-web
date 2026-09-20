import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { ActivityEvent, DashboardSummary, Order, SalesDay } from "@/types";
import { summarizeOrders } from "./sales-days";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function getTodaySalesTotals() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const q = query(
    collection(db, "sales"),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end))
  );
  const snapshot = await getDocs(q);

  let todaySalesCents = 0;
  let todayReceivedCents = 0;
  let pendingCents = 0;
  let fiadoCents = 0;

  for (const doc of snapshot.docs) {
    const sale = doc.data();
    todaySalesCents += sale.totalCents;
    todayReceivedCents += sale.paidCents;
    pendingCents += sale.pendingCents;
    if (sale.paidCents === 0) fiadoCents += sale.totalCents;
  }

  return { todaySalesCents, todayReceivedCents, pendingCents, fiadoCents, salesCount: snapshot.size };
}

async function getUpcomingOrders(): Promise<Order[]> {
  const q = query(
    collection(db, "orders"),
    where("expectedDate", ">=", todayIso()),
    orderBy("expectedDate", "asc"),
    limit(15)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((d) => {
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
      } as Order;
    })
    .filter((o) => o.status !== "entregue" && o.status !== "cancelada")
    .slice(0, 5);
}

// Próximo Dia de Venda aberto: busca os abertos ordenados por data e pega o
// primeiro a partir de hoje. Como o Dia de Venda só grava o instantâneo de
// valores ao ser encerrado (seção 15), aqui calculamos ao vivo a partir dos
// pedidos vinculados — igual à tela de detalhe (Fase 5).
async function getNextSalesDay(): Promise<SalesDay | null> {
  const q = query(
    collection(db, "salesDays"),
    where("closed", "==", false),
    orderBy("date", "asc"),
    limit(10)
  );
  const snapshot = await getDocs(q);
  const today = todayIso();
  const nextDayDoc = snapshot.docs.find((d) => d.data().date >= today);
  if (!nextDayDoc) return null;

  const ordersSnap = await getDocs(
    query(collection(db, "orders"), where("salesDayId", "==", nextDayDoc.id))
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
  const summary = summarizeOrders(orders);

  return {
    id: nextDayDoc.id,
    date: nextDayDoc.data().date,
    expectedCents: summary.expectedCents,
    receivedCents: summary.receivedCents,
    pendingCents: summary.pendingCents,
    cancelledCents: summary.cancelledCents,
    notRealizedCents: summary.notRealizedCents,
    ordersCount: summary.ordersCount,
    closed: false,
  };
}

async function getRecentActivity(): Promise<ActivityEvent[]> {
  const q = query(collection(db, "activityHistory"), orderBy("createdAt", "desc"), limit(6));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      type: data.type,
      description: data.description,
      referenceId: data.referenceId,
      createdAt: tsToIso(data.createdAt),
    };
  });
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [salesTotals, upcomingOrders, nextSalesDay, recentActivity] = await Promise.all([
    getTodaySalesTotals(),
    getUpcomingOrders(),
    getNextSalesDay(),
    getRecentActivity(),
  ]);

  return {
    ...salesTotals,
    upcomingOrders,
    nextSalesDay,
    recentActivity,
  };
}
