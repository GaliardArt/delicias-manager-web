import { collection, getDocs, limit, orderBy, query, Timestamp, where } from "firebase/firestore";
import { db } from "./config";
import { ActivityEvent, DashboardSummary, Order, SalesDay } from "@/types";
import { getOpenDayGroups, summarizeOrders, todayIso } from "./sales-days";
import { summarizeSales } from "./reports";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
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
        deliveryAddress: data.deliveryAddress,
        notes: data.notes,
        status: data.status,
      } as Order;
    })
    .filter((o) => o.status !== "entregue" && o.status !== "cancelada")
    .slice(0, 5);
}

// Próximo Dia de Venda: o primeiro grupo automático (encomendas agrupadas por
// data, ainda sem fechamento) a partir de hoje. Não existe mais um documento
// "aberto" no Firestore — o grupo é calculado ao vivo (Fase Dias de Venda
// automáticos).
async function getNextSalesDay(): Promise<SalesDay | null> {
  const groups = await getOpenDayGroups();
  const today = todayIso();
  const next = groups.find((g) => g.date >= today);
  if (!next) return null;

  const summary = summarizeOrders(next.orders);
  const salesSummary = summarizeSales(next.sales);

  return {
    id: next.date,
    date: next.date,
    expectedCents: summary.expectedCents + salesSummary.faturamentoCents,
    receivedCents: summary.receivedCents + salesSummary.recebidoCents,
    pendingCents: summary.pendingCents + salesSummary.pendenteCents,
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
