import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "./config";
import { ActivityEvent, DashboardSummary, SalesDay } from "@/types";
import { getOpenDayGroupsData, summarizeOrders, todayIso } from "./sales-days";
import { summarizeSales } from "./reports";
import { readThroughCache } from "./read-cache";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

// Próximo Dia de Venda: o primeiro grupo automático (encomendas agrupadas por
// data, ainda sem fechamento) a partir de hoje. Não existe mais um documento
// "aberto" no Firestore — o grupo é calculado ao vivo (Fase Dias de Venda
// automáticos).
function getNextSalesDay(groups: Awaited<ReturnType<typeof getOpenDayGroupsData>>["groups"], today: string): SalesDay | null {
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
  return readThroughCache("dashboard/summary", async () => {
  const today = todayIso();
  const [dayData, recentActivity] = await Promise.all([
    getOpenDayGroupsData(today),
    getRecentActivity(),
  ]);

  const todaySales = dayData.sales.filter((sale) => {
    const date = sale.createdAt;
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return dateKey === today;
  });
  const todaySalesSummary = summarizeSales(todaySales);
  const fiadoCents = todaySales.reduce(
    (sum, sale) => sum + (sale.paidCents === 0 ? sale.totalCents : 0),
    0
  );
  const upcomingOrders = [...dayData.orders]
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate))
    .slice(0, 15)
    .filter((order) => order.status !== "finalizada" && order.status !== "cancelada")
    .slice(0, 5);

  return {
    todaySalesCents: todaySalesSummary.faturamentoLiquidoCents,
    todayReceivedCents: todaySalesSummary.recebidoCents,
    pendingCents: todaySalesSummary.pendenteCents,
    fiadoCents,
    salesCount: todaySales.length,
    upcomingOrders,
    nextSalesDay: getNextSalesDay(dayData.groups, today),
    recentActivity,
  };
  });
}
