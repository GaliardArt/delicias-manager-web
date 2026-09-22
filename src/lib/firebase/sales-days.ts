import {
  collection,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";
import { Order } from "@/types";
import { getAllSalesRaw, RawSale, summarizeSales, SalesSummary } from "./reports";
import { normalizeSaleItems } from "@/lib/utils/normalize-items";

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return new Date().toISOString();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface SalesDayDoc {
  id: string;
  date: string; // YYYY-MM-DD
  closed: boolean; // sempre true — só existe documento depois do fechamento
  createdAt: string;
  // Totais combinados (encomendas do dia + vendas avulsas feitas no dia)
  expectedCents: number;
  receivedCents: number;
  pendingCents: number;
  cancelledCents: number;
  notRealizedCents: number;
  ordersCount: number;
  // Recorte só das vendas avulsas (subconjunto de expectedCents/receivedCents),
  // guardado separado para nunca esconder de onde veio o número (seção 21).
  salesCents: number;
  salesReceivedCents: number;
  salesCount: number;
}

function mapOrderDoc(id: string, data: DocumentData): Order {
  return {
    id,
    customerId: data.customerId,
    customerName: data.customerName,
    items: normalizeSaleItems(data.items),
    totalCents: data.totalCents,
    paidCents: data.paidCents,
    pendingCents: data.pendingCents,
    payments: [],
    orderDate: data.orderDate,
    expectedDate: data.expectedDate,
    deliveryAddress: data.deliveryAddress,
    notes: data.notes,
    status: data.status,
  };
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

export interface AddressGroup {
  address: string;
  orders: { customerName: string; itemsQuantity: number }[];
  totalQuantity: number;
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

export interface OpenDayGroup {
  date: string;
  orders: Order[];
  sales: RawSale[];
  totalCents: number;
}

// Dias de Venda "automáticos": nenhum documento é criado até o fechamento.
// Agrupa por data tanto as encomendas ativas (por data prevista de entrega)
// quanto as vendas do dia (por data da venda) — uma venda de balcão feita hoje
// entra no valor de "hoje" do mesmo jeito que uma encomenda prevista para hoje.
// Pula datas que já têm um fechamento gravado.
export async function getOpenDayGroups(): Promise<OpenDayGroup[]> {
  const [closedDaysSnap, ordersSnap, allSales] = await Promise.all([
    getDocs(collection(db, "salesDays")),
    getDocs(collection(db, "orders")),
    getAllSalesRaw(),
  ]);

  const closedDates = new Set(closedDaysSnap.docs.map((d) => d.data().date as string));
  const orderGroups = new Map<string, Order[]>();
  const salesGroups = new Map<string, RawSale[]>();

  for (const d of ordersSnap.docs) {
    const data = d.data();
    if (data.status === "cancelada") continue;
    if (closedDates.has(data.expectedDate)) continue;
    const order = mapOrderDoc(d.id, data);
    if (!orderGroups.has(order.expectedDate)) orderGroups.set(order.expectedDate, []);
    orderGroups.get(order.expectedDate)!.push(order);
  }

  for (const sale of allSales) {
    const key = dateKey(sale.createdAt);
    if (closedDates.has(key)) continue;
    if (!salesGroups.has(key)) salesGroups.set(key, []);
    salesGroups.get(key)!.push(sale);
  }

  const allDates = new Set([...orderGroups.keys(), ...salesGroups.keys()]);

  return Array.from(allDates)
    .map((date) => {
      const orders = orderGroups.get(date) ?? [];
      const sales = salesGroups.get(date) ?? [];
      return {
        date,
        orders,
        sales,
        totalCents:
          orders.reduce((sum, o) => sum + o.totalCents, 0) +
          sales.reduce((sum, s) => sum + s.totalCents, 0),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Só as encomendas ativas de uma data — usado na tela de fechamento.
export async function getActiveOrdersForDate(date: string): Promise<Order[]> {
  const q = query(collection(db, "orders"), where("expectedDate", "==", date));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => mapOrderDoc(d.id, d.data()))
    .filter((o) => o.status !== "cancelada");
}

// Vendas (não-encomenda) feitas numa data específica — usado na tela de
// fechamento para somar ao valor do dia (seção pedida: "vendas avulsas do dia
// entram no valor do Dia de Venda").
export async function getSalesForDate(date: string): Promise<RawSale[]> {
  const allSales = await getAllSalesRaw();
  return allSales.filter((s) => dateKey(s.createdAt) === date);
}

// Fecha o dia: grava o instantâneo dos totais (seção 15), combinando encomendas
// + vendas avulsas do dia. As encomendas já devem estar com os pagamentos
// "Pago" registrados de verdade (feito antes de chamar esta função). Não existe
// edição depois disso; cada valor continua rastreável até a origem (seção 21) —
// por isso o recorte de vendas fica guardado separado, não só somado.
export async function closeDay(
  date: string,
  orders: Order[],
  sales: RawSale[]
): Promise<string> {
  const ordersSummary = summarizeOrders(orders);
  const salesSummary: SalesSummary = summarizeSales(sales);

  const batch = writeBatch(db);
  const dayRef = doc(collection(db, "salesDays"));

  batch.set(dayRef, {
    date,
    closed: true,
    expectedCents: ordersSummary.expectedCents + salesSummary.faturamentoCents,
    receivedCents: ordersSummary.receivedCents + salesSummary.recebidoCents,
    pendingCents: ordersSummary.pendingCents + salesSummary.pendenteCents,
    cancelledCents: ordersSummary.cancelledCents,
    notRealizedCents: ordersSummary.notRealizedCents,
    ordersCount: ordersSummary.ordersCount,
    salesCents: salesSummary.faturamentoCents,
    salesReceivedCents: salesSummary.recebidoCents,
    salesCount: salesSummary.quantidadeVendas,
    createdAt: serverTimestamp(),
  });

  const activityRef = doc(collection(db, "activityHistory"));
  batch.set(activityRef, {
    type: "dia_venda_encerrado",
    description: `Dia de Venda de ${new Date(date + "T00:00:00").toLocaleDateString(
      "pt-BR"
    )} encerrado`,
    referenceId: dayRef.id,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return dayRef.id;
}

export async function listClosedDays(): Promise<SalesDayDoc[]> {
  const q = query(collection(db, "salesDays"), orderBy("date", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SalesDayDoc, "id" | "createdAt">),
    createdAt: tsToIso(d.data().createdAt),
  }));
}

// Detalhe de um dia já fechado — busca as encomendas daquela data (aqui sim
// incluindo as canceladas, para o histórico ficar completo). Os totais de
// vendas vêm direto do instantâneo gravado no fechamento (salesCents etc no
// próprio SalesDayDoc), não são recalculados.
export async function getClosedDayWithOrders(
  dayId: string
): Promise<{ day: SalesDayDoc; orders: Order[] } | null> {
  const daySnap = await getDoc(doc(db, "salesDays", dayId));
  if (!daySnap.exists()) return null;
  const day = {
    id: daySnap.id,
    ...(daySnap.data() as Omit<SalesDayDoc, "id" | "createdAt">),
    createdAt: tsToIso(daySnap.data().createdAt),
  };

  const ordersSnap = await getDocs(
    query(collection(db, "orders"), where("expectedDate", "==", day.date))
  );
  const orders = ordersSnap.docs.map((d) => mapOrderDoc(d.id, d.data()));

  return { day, orders };
}

export { todayIso };
