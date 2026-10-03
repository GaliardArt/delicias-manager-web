import {
  collection,
  DocumentData,
  getDocs,
  query,
  Query,
  QuerySnapshot,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "./config";
import { readThroughCache } from "./read-cache";
import { Customer, Ingrediente, Insumo, Product, OrderStatus } from "@/types";
import { normalizeOrderStatus } from "@/lib/utils/order-status";
import {
  getProductExtraCost,
  resolveProductCost,
  resolveRecipeCost,
  toIngredientesMap,
  toInsumosMap,
} from "@/lib/costing";

export interface RawSale {
  id: string;
  customerId: string;
  customerName: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  createdAt: Date;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitCostCents: number;
    totalCents: number;
  }[];
}

export interface RawOrder {
  id: string;
  customerId: string;
  customerName: string;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  orderDate: string;
  expectedDate: string;
  status: OrderStatus;
  createdAt: Date | null;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitCostCents: number;
    totalCents: number;
  }[];
}

function mapSalesSnapshot(snapshot: QuerySnapshot<DocumentData>): RawSale[] {
  return snapshot.docs.map((d) => {
    const data = d.data();
    const createdAt =
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
    const items = Array.isArray(data.items) ? data.items : [];
    const fallbackSubtotalCents = items.reduce(
      (sum, item) => sum + Number(item.totalCents ?? 0),
      0
    );

    return {
      id: d.id,
      customerId: data.customerId ?? "",
      customerName: data.customerName ?? "Venda avulsa",
      subtotalCents: Number(data.subtotalCents ?? fallbackSubtotalCents),
      discountCents: Number(data.discountCents ?? 0),
      totalCents: Number(
        data.totalCents ?? Math.max(0, fallbackSubtotalCents - Number(data.discountCents ?? 0))
      ),
      paidCents: Number(data.paidCents ?? 0),
      pendingCents: Number(data.pendingCents ?? 0),
      createdAt,
      items: items.map((item) => ({
        productId: item.productId ?? "",
        productName: item.productName ?? "Produto",
        quantity: Number(item.quantity ?? 0),
        unitCostCents: Number(item.unitCostCents ?? 0),
        totalCents: Number(item.totalCents ?? 0),
      })),
    };
  });
}

// Uma única leitura da coleção `sales` — tudo o mais é calculado em memória.
// Quando a tela precisa de um dia, a consulta fica restrita ao intervalo local.
export async function getAllSalesRaw(date?: string): Promise<RawSale[]> {
  return readThroughCache(`reports/sales/${date ?? "all"}`, async () => {
  const salesCollection = collection(db, "sales");
  let salesQuery: Query<DocumentData> = salesCollection;
  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    salesQuery = query(
      salesCollection,
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<", Timestamp.fromDate(end))
    );
  }
  const snapshot = await getDocs(salesQuery);
  return mapSalesSnapshot(snapshot);
  });
}

export async function getSalesFromDateRaw(date: string): Promise<RawSale[]> {
  return readThroughCache(`reports/sales-from/${date}`, async () => {
  const start = new Date(`${date}T00:00:00`);
  const snapshot = await getDocs(
    query(
      collection(db, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(start))
    )
  );
  return mapSalesSnapshot(snapshot);
  });
}

export async function getAllOrdersRaw(): Promise<RawOrder[]> {
  return readThroughCache("reports/orders/all", async () => {
  const snapshot = await getDocs(collection(db, "orders"));
  return snapshot.docs.map((d) => {
    const data = d.data();
    const createdAt =
      data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null;
    const items = Array.isArray(data.items) ? data.items : [];

    return {
      id: d.id,
      customerId: data.customerId ?? "",
      customerName: data.customerName ?? "Cliente",
      totalCents: Number(data.totalCents ?? 0),
      paidCents: Number(data.paidCents ?? 0),
      pendingCents: Number(data.pendingCents ?? 0),
      orderDate: data.orderDate ?? "",
      expectedDate: data.expectedDate ?? "",
      status: normalizeOrderStatus(data.status),
      createdAt,
      items: items.map((item) => ({
        productId: item.productId ?? "",
        productName: item.productName ?? "Produto",
        quantity: Number(item.quantity ?? 0),
        unitCostCents: Number(item.unitCostCents ?? 0),
        totalCents: Number(item.totalCents ?? 0),
      })),
    };
  });
  });
}

export type PeriodKey =
  | "hoje"
  | "semana"
  | "mes"
  | "mes_atual"
  | "mes_anterior"
  | "trimestre"
  | "personalizado";

export interface Period {
  key: PeriodKey;
  label: string;
  start: Date;
  end: Date;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dateOnlyToDate(value: string): Date {
  return new Date(value + "T00:00:00");
}

export function getPeriodPreset(
  key: Exclude<PeriodKey, "personalizado">
): Period {
  const today = startOfDay(new Date());

  if (key === "hoje") {
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { key, label: "Hoje", start: today, end };
  }

  if (key === "mes_anterior") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 1);
    return { key, label: "Mês anterior", start, end };
  }

  if (key === "mes_atual") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { key, label: "Este mês", start, end };
  }

  if (key === "trimestre") {
    const start = new Date(today);
    start.setDate(start.getDate() - 89);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { key, label: "Últimos 90 dias", start, end };
  }

  if (key === "semana") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { key, label: "Últimos 7 dias", start, end };
  }

  const start = key === "mes" ? new Date(today) : new Date(today);
  start.setDate(start.getDate() - 29);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);
  return { key, label: "Últimos 30 dias", start, end };
}

export function getCustomPeriod(startStr: string, endStr: string): Period {
  const start = startOfDay(dateOnlyToDate(startStr));
  const end = startOfDay(dateOnlyToDate(endStr));
  end.setDate(end.getDate() + 1);
  return { key: "personalizado", label: "Período personalizado", start, end };
}

export function getPreviousPeriod(period: Period): Period {
  const lengthMs = period.end.getTime() - period.start.getTime();
  const end = new Date(period.start);
  const start = new Date(period.start.getTime() - lengthMs);
  return { key: period.key, label: "Período anterior", start, end };
}

export function filterByPeriod(sales: RawSale[], period: Period): RawSale[] {
  return sales.filter((s) => s.createdAt >= period.start && s.createdAt < period.end);
}

export function filterOrdersByPeriod(orders: RawOrder[], period: Period): RawOrder[] {
  return orders.filter((order) => {
    const dateValue = order.createdAt ?? (order.orderDate ? dateOnlyToDate(order.orderDate) : null);
    return dateValue ? dateValue >= period.start && dateValue < period.end : false;
  });
}

export interface SalesSummary {
  subtotalCents: number;
  discountCents: number;
  faturamentoBrutoCents: number;
  faturamentoLiquidoCents: number;
  faturamentoCents: number;
  recebidoCents: number;
  pendenteCents: number;
  quantidadeVendas: number;
  quantidadeItens: number;
  ticketMedioCents: number;
  custoCents: number;
  lucroBrutoCents: number;
  margemBrutaPct: number | null;
  descontoPct: number | null;
}

export function summarizeSales(sales: RawSale[]): SalesSummary {
  const quantidadeVendas = sales.length;
  let subtotalCents = 0;
  let discountCents = 0;
  let faturamentoLiquidoCents = 0;
  let recebidoCents = 0;
  let pendenteCents = 0;
  let quantidadeItens = 0;
  let custoCents = 0;

  for (const sale of sales) {
    subtotalCents += sale.subtotalCents;
    discountCents += sale.discountCents;
    faturamentoLiquidoCents += sale.totalCents;
    recebidoCents += sale.paidCents;
    pendenteCents += sale.pendingCents;
    let saleQuantityItems = 0;
    let saleCostCents = 0;
    for (const item of sale.items) {
      saleQuantityItems += item.quantity;
      saleCostCents += Math.round(item.unitCostCents * item.quantity);
    }
    quantidadeItens += saleQuantityItems;
    custoCents += saleCostCents;
  }

  const faturamentoBrutoCents = subtotalCents;
  const faturamentoCents = faturamentoLiquidoCents;
  const ticketMedioCents =
    quantidadeVendas > 0 ? Math.round(faturamentoLiquidoCents / quantidadeVendas) : 0;
  const lucroBrutoCents = faturamentoLiquidoCents - custoCents;

  return {
    subtotalCents,
    discountCents,
    faturamentoBrutoCents,
    faturamentoLiquidoCents,
    faturamentoCents,
    recebidoCents,
    pendenteCents,
    quantidadeVendas,
    quantidadeItens,
    ticketMedioCents,
    custoCents,
    lucroBrutoCents,
    margemBrutaPct:
      faturamentoLiquidoCents > 0 ? (lucroBrutoCents / faturamentoLiquidoCents) * 100 : null,
    descontoPct:
      faturamentoBrutoCents > 0 ? (discountCents / faturamentoBrutoCents) * 100 : null,
  };
}

export interface ProductRanking {
  productId?: string;
  name: string;
  quantity: number;
  revenueCents: number;
}

export interface ProductPerformance extends ProductRanking {
  costCents: number;
  profitCents: number;
  marginPct: number | null;
  previousQuantity: number;
  quantityChangePct: number | null;
  active: boolean;
}

function allocateDiscount(discountCents: number, lineGrossCents: number, saleGrossCents: number): number {
  if (discountCents <= 0 || lineGrossCents <= 0 || saleGrossCents <= 0) return 0;
  return Math.min(lineGrossCents, Math.round((discountCents * lineGrossCents) / saleGrossCents));
}

export function buildProductPerformance(
  current: RawSale[],
  previous: RawSale[],
  allProducts: Product[]
): ProductPerformance[] {
  const previousQtyByProduct = new Map<string, number>();
  for (const sale of previous) {
    for (const item of sale.items) {
      previousQtyByProduct.set(
        item.productId,
        (previousQtyByProduct.get(item.productId) ?? 0) + item.quantity
      );
    }
  }

  const map = new Map<string, ProductPerformance>();
  for (const product of allProducts) {
    map.set(product.id, {
      productId: product.id,
      name: product.name,
      quantity: 0,
      revenueCents: 0,
      costCents: 0,
      profitCents: 0,
      marginPct: null,
      previousQuantity: previousQtyByProduct.get(product.id) ?? 0,
      quantityChangePct: null,
      active: product.active,
    });
  }

  for (const sale of current) {
    const grossSale = sale.items.reduce((sum, item) => sum + item.totalCents, 0);
    for (const item of sale.items) {
      const entry = map.get(item.productId) ?? {
        productId: item.productId,
        name: item.productName,
        quantity: 0,
        revenueCents: 0,
        costCents: 0,
        profitCents: 0,
        marginPct: null,
        previousQuantity: previousQtyByProduct.get(item.productId) ?? 0,
        quantityChangePct: null,
        active: false,
      };

      const discountAllocated = allocateDiscount(sale.discountCents, item.totalCents, grossSale);
      const netLineCents = Math.max(0, item.totalCents - discountAllocated);
      const costCents = Math.round(item.unitCostCents * item.quantity);

      entry.quantity += item.quantity;
      entry.revenueCents += netLineCents;
      entry.costCents += costCents;
      entry.profitCents += netLineCents - costCents;
      map.set(item.productId, entry);
    }
  }

  return Array.from(map.values()).map((item) => ({
    ...item,
    marginPct: item.revenueCents > 0 ? (item.profitCents / item.revenueCents) * 100 : null,
    quantityChangePct:
      item.previousQuantity > 0
        ? ((item.quantity - item.previousQuantity) / item.previousQuantity) * 100
        : null,
  }));
}

export function summarizeProducts(
  sales: RawSale[],
  activeProducts: Product[]
): { topSelling: ProductRanking[]; leastSelling: ProductRanking[] } {
  const performance = buildProductPerformance(sales, [], activeProducts);
  const sold = performance.filter((p) => p.quantity > 0);
  const topSelling = [...sold]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      quantity: p.quantity,
      revenueCents: p.revenueCents,
    }));
  const leastSelling = [...performance]
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, 5)
    .map((p) => ({
      productId: p.productId,
      name: p.name,
      quantity: p.quantity,
      revenueCents: p.revenueCents,
    }));
  return { topSelling, leastSelling };
}

export interface CustomerRanking {
  id?: string;
  name: string;
  totalCents: number;
  purchaseCount: number;
}

export function summarizeTopCustomers(sales: RawSale[]): CustomerRanking[] {
  const map = new Map<string, CustomerRanking>();
  for (const sale of sales) {
    if (!sale.customerId) continue;
    const entry = map.get(sale.customerId) ?? {
      id: sale.customerId,
      name: sale.customerName,
      totalCents: 0,
      purchaseCount: 0,
    };
    entry.totalCents += sale.totalCents;
    entry.purchaseCount += 1;
    map.set(sale.customerId, entry);
  }
  return Array.from(map.values())
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 5);
}

export function summarizePendingCustomers(allSales: RawSale[]): CustomerRanking[] {
  const map = new Map<string, CustomerRanking>();
  for (const sale of allSales) {
    if (!sale.customerId || sale.pendingCents <= 0) continue;
    const entry = map.get(sale.customerId) ?? {
      id: sale.customerId,
      name: sale.customerName,
      totalCents: 0,
      purchaseCount: 0,
    };
    entry.totalCents += sale.pendingCents;
    entry.purchaseCount += 1;
    map.set(sale.customerId, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
}

export interface InactiveCustomer {
  id?: string;
  name: string;
  phone: string;
  lastPurchaseAt: string | null;
}

export function findInactiveCustomers(
  allSales: RawSale[],
  activeCustomers: Customer[],
  thresholdDays = 30
): InactiveCustomer[] {
  const lastPurchase = new Map<string, Date>();
  for (const sale of allSales) {
    if (!sale.customerId) continue;
    const current = lastPurchase.get(sale.customerId);
    if (!current || sale.createdAt > current) lastPurchase.set(sale.customerId, sale.createdAt);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);

  return activeCustomers
    .filter((customer) => {
      const last = lastPurchase.get(customer.id);
      return !last || last < cutoff;
    })
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      lastPurchaseAt: lastPurchase.get(customer.id)?.toISOString() ?? null,
    }));
}

export interface Trends {
  hasEnoughData: boolean;
  revenueChangePct: number | null;
  ticketChangePct: number | null;
  busiestWeekday: string | null;
  growingProducts: { name: string; delta: number }[];
  decliningProducts: { name: string; delta: number }[];
}

const weekdayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function computeTrends(current: RawSale[], previous: RawSale[]): Trends {
  if (current.length === 0 && previous.length === 0) {
    return {
      hasEnoughData: false,
      revenueChangePct: null,
      ticketChangePct: null,
      busiestWeekday: null,
      growingProducts: [],
      decliningProducts: [],
    };
  }

  const currentSummary = summarizeSales(current);
  const previousSummary = summarizeSales(previous);

  const revenueChangePct =
    previousSummary.faturamentoLiquidoCents > 0
      ? ((currentSummary.faturamentoLiquidoCents - previousSummary.faturamentoLiquidoCents) /
          previousSummary.faturamentoLiquidoCents) *
        100
      : null;

  const ticketChangePct =
    previousSummary.ticketMedioCents > 0
      ? ((currentSummary.ticketMedioCents - previousSummary.ticketMedioCents) /
          previousSummary.ticketMedioCents) *
        100
      : null;

  const weekdayCounts = new Array<number>(7).fill(0);
  for (const sale of current) {
    const weekday = sale.createdAt.getDay();
    const count = weekdayCounts[weekday];
    if (count !== undefined) {
      weekdayCounts[weekday] = count + 1;
    }
  }
  const maxCount = Math.max(...weekdayCounts);
  const busiestWeekday =
    maxCount > 0 ? weekdayNames[weekdayCounts.indexOf(maxCount)] ?? null : null;

  const currentQty = new Map<string, number>();
  const previousQty = new Map<string, number>();

  for (const sale of current) {
    for (const item of sale.items) {
      currentQty.set(item.productName, (currentQty.get(item.productName) ?? 0) + item.quantity);
    }
  }
  for (const sale of previous) {
    for (const item of sale.items) {
      previousQty.set(item.productName, (previousQty.get(item.productName) ?? 0) + item.quantity);
    }
  }

  const names = new Set([...currentQty.keys(), ...previousQty.keys()]);
  const deltas = Array.from(names).map((name) => ({
    name,
    delta: (currentQty.get(name) ?? 0) - (previousQty.get(name) ?? 0),
  }));

  return {
    hasEnoughData: true,
    revenueChangePct,
    ticketChangePct,
    busiestWeekday,
    growingProducts: deltas.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3),
    decliningProducts: deltas.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3),
  };
}

export interface DailyMetric {
  date: string;
  label: string;
  revenueCents: number;
  costCents: number;
  profitCents: number;
  quantitySales: number;
  quantityItems: number;
}

export function buildDailyMetrics(sales: RawSale[], period: Period): DailyMetric[] {
  const days: DailyMetric[] = [];
  const salesByLocalDay = new Map<string, RawSale[]>();
  for (const sale of sales) {
    const date = sale.createdAt;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const bucket = salesByLocalDay.get(key) ?? [];
    bucket.push(sale);
    salesByLocalDay.set(key, bucket);
  }
  const cursor = new Date(period.start);
  const maxDays = Math.min(120, Math.max(1, Math.ceil((period.end.getTime() - period.start.getTime()) / 86400000)));

  for (let i = 0; i < maxDays; i += 1) {
    const start = new Date(cursor);

    const localKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const inDay = salesByLocalDay.get(localKey) ?? [];
    const summary = summarizeSales(inDay);

    days.push({
      date: start.toISOString().slice(0, 10),
      label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      revenueCents: summary.faturamentoLiquidoCents,
      costCents: summary.custoCents,
      profitCents: summary.lucroBrutoCents,
      quantitySales: summary.quantidadeVendas,
      quantityItems: summary.quantidadeItens,
    });

    cursor.setDate(cursor.getDate() + 1);
    if (cursor >= period.end) break;
  }

  return days;
}

export interface WeekdayMetric {
  weekday: number;
  label: string;
  sales: number;
  revenueCents: number;
  averageTicketCents: number;
}

export function buildWeekdayMetrics(sales: RawSale[]): WeekdayMetric[] {
  const map = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    label: weekdayNames[weekday] ?? "",
    sales: 0,
    revenueCents: 0,
    averageTicketCents: 0,
  }));

  for (const sale of sales) {
    const entry = map[sale.createdAt.getDay()];
    if (!entry) continue;
    entry.sales += 1;
    entry.revenueCents += sale.totalCents;
  }

  return map.map((entry) => ({
    ...entry,
    averageTicketCents: entry.sales > 0 ? Math.round(entry.revenueCents / entry.sales) : 0,
  }));
}

export interface MonthlyEvolution {
  label: string;
  faturamentoCents: number;
  ticketMedioCents: number;
  quantidadeVendas: number;
  custoCents: number;
  lucroBrutoCents: number;
}

export function computeMonthlyEvolution(allSales: RawSale[], monthsBack = 6): MonthlyEvolution[] {
  const months: MonthlyEvolution[] = [];
  const now = new Date();
  const salesByMonth = new Map<string, RawSale[]>();
  for (const sale of allSales) {
    const date = sale.createdAt;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = salesByMonth.get(key) ?? [];
    bucket.push(sale);
    salesByMonth.set(key, bucket);
  }

  for (let i = monthsBack - 1; i >= 0; i -= 1) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = salesByMonth.get(monthKey) ?? [];
    const summary = summarizeSales(inMonth);

    months.push({
      label: monthStart.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      faturamentoCents: summary.faturamentoLiquidoCents,
      ticketMedioCents: summary.ticketMedioCents,
      quantidadeVendas: summary.quantidadeVendas,
      custoCents: summary.custoCents,
      lucroBrutoCents: summary.lucroBrutoCents,
    });
  }

  return months;
}

export interface CustomerBehavior {
  newCustomers: number;
  returningCustomers: number;
}

export function computeCustomerBehavior(allSales: RawSale[], period: Period): CustomerBehavior {
  const registeredSales = allSales.filter((sale) => sale.customerId);
  const firstPurchase = new Map<string, Date>();

  for (const sale of registeredSales) {
    const current = firstPurchase.get(sale.customerId);
    if (!current || sale.createdAt < current) firstPurchase.set(sale.customerId, sale.createdAt);
  }

  const customersInPeriod = new Set(
    registeredSales
      .filter((sale) => sale.createdAt >= period.start && sale.createdAt < period.end)
      .map((sale) => sale.customerId)
  );

  let newCustomers = 0;
  let returningCustomers = 0;

  for (const customerId of customersInPeriod) {
    const first = firstPurchase.get(customerId);
    if (first && first >= period.start && first < period.end) newCustomers += 1;
    else returningCustomers += 1;
  }

  return { newCustomers, returningCustomers };
}

export interface CustomerMetrics extends CustomerRanking {
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  averageTicketCents: number;
  quantityItems: number;
  pendingCents: number;
  discountCents: number;
  frequencyDays: number | null;
  favoriteProductName: string | null;
  favoriteProductQuantity: number;
}

export function buildCustomerMetrics(
  current: RawSale[],
  allSales: RawSale[],
  customers: Customer[]
): CustomerMetrics[] {
  const globalByCustomer = new Map<string, RawSale[]>();
  for (const sale of allSales) {
    if (!sale.customerId) continue;
    const bucket = globalByCustomer.get(sale.customerId) ?? [];
    bucket.push(sale);
    globalByCustomer.set(sale.customerId, bucket);
  }

  const currentByCustomer = new Map<string, RawSale[]>();
  for (const sale of current) {
    if (!sale.customerId) continue;
    const bucket = currentByCustomer.get(sale.customerId) ?? [];
    bucket.push(sale);
    currentByCustomer.set(sale.customerId, bucket);
  }

  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.name]));
  for (const sale of allSales) {
    if (sale.customerId && !customerNameById.has(sale.customerId)) {
      customerNameById.set(sale.customerId, sale.customerName);
    }
  }

  const ids = new Set([...currentByCustomer.keys(), ...customerNameById.keys()]);
  return Array.from(ids).map((id) => {
    const currentSales = currentByCustomer.get(id) ?? [];
    const globalSales = globalByCustomer.get(id) ?? [];

    let totalCents = 0;
    let purchaseCount = 0;
    let quantityItems = 0;
    let discountCents = 0;

    for (const sale of currentSales) {
      totalCents += sale.totalCents;
      purchaseCount += 1;
      discountCents += sale.discountCents;
      quantityItems += sale.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    const first = globalSales.reduce<Date | null>(
      (min, sale) => (!min || sale.createdAt < min ? sale.createdAt : min),
      null
    );
    const last = globalSales.reduce<Date | null>(
      (max, sale) => (!max || sale.createdAt > max ? sale.createdAt : max),
      null
    );
    const pendingCents = globalSales.reduce((sum, sale) => sum + Math.max(0, sale.pendingCents), 0);
    const productQuantities = new Map<string, number>();
    for (const sale of globalSales) {
      for (const item of sale.items) {
        productQuantities.set(
          item.productName,
          (productQuantities.get(item.productName) ?? 0) + item.quantity
        );
      }
    }
    const favoriteProductEntry = Array.from(productQuantities.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0];

    const dates = globalSales
      .map((sale) => sale.createdAt.getTime())
      .sort((a, b) => a - b);
    let frequencyDays: number | null = null;
    if (dates.length >= 2) {
      const gaps: number[] = [];
      for (let index = 1; index < dates.length; index += 1) {
        const previousDate = dates[index - 1];
        const currentDate = dates[index];
        if (previousDate !== undefined && currentDate !== undefined) {
          gaps.push(currentDate - previousDate);
        }
      }
      const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      frequencyDays = Math.max(0, Math.round(avgGap / 86400000));
    }

    return {
      id,
      name: customerNameById.get(id) ?? "Cliente",
      totalCents,
      purchaseCount,
      firstPurchaseAt: first?.toISOString() ?? null,
      lastPurchaseAt: last?.toISOString() ?? null,
      averageTicketCents: purchaseCount > 0 ? Math.round(totalCents / purchaseCount) : 0,
      quantityItems,
      pendingCents,
      discountCents,
      frequencyDays,
      favoriteProductName: favoriteProductEntry?.[0] ?? null,
      favoriteProductQuantity: favoriteProductEntry?.[1] ?? 0,
    };
  }).filter((customer) => customer.purchaseCount > 0);
}

export interface ReceivableBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  quantitySales: number;
  amountCents: number;
}

export function buildReceivableAging(allSales: RawSale[]): ReceivableBucket[] {
  const now = new Date();
  const buckets: ReceivableBucket[] = [
    { label: "0–7 dias", minDays: 0, maxDays: 7, quantitySales: 0, amountCents: 0 },
    { label: "8–30 dias", minDays: 8, maxDays: 30, quantitySales: 0, amountCents: 0 },
    { label: "31–60 dias", minDays: 31, maxDays: 60, quantitySales: 0, amountCents: 0 },
    { label: "+60 dias", minDays: 61, maxDays: null, quantitySales: 0, amountCents: 0 },
  ];

  for (const sale of allSales) {
    if (sale.pendingCents <= 0) continue;
    const ageDays = Math.max(
      0,
      Math.floor((startOfDay(now).getTime() - startOfDay(sale.createdAt).getTime()) / 86400000)
    );
    const bucket =
      buckets.find(
        (item) => ageDays >= item.minDays && (item.maxDays === null || ageDays <= item.maxDays)
      ) ?? buckets[buckets.length - 1];

    if (bucket) {
      bucket.quantitySales += 1;
      bucket.amountCents += sale.pendingCents;
    }
  }

  return buckets;
}

export interface ExpenseCategoryMetric {
  category: string;
  amountCents: number;
  sharePct: number;
}

export function buildExpenseCategories(
  expenses: { category: string; amountCents: number }[],
  totalCents?: number
): ExpenseCategoryMetric[] {
  const map = new Map<string, number>();
  for (const expense of expenses) {
    const key = expense.category?.trim() || "Sem categoria";
    map.set(key, (map.get(key) ?? 0) + Number(expense.amountCents ?? 0));
  }

  const total = totalCents ?? Array.from(map.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(map.entries())
    .map(([category, amountCents]) => ({
      category,
      amountCents,
      sharePct: total > 0 ? (amountCents / total) * 100 : 0,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export interface InventoryMetric {
  id: string;
  name: string;
  kind: "produto" | "insumo" | "ingrediente";
  unit: string;
  quantity: number;
  unitCostCents: number;
  stockValueCents: number;
  active: boolean;
  noStock: boolean;
}

export interface InventorySummary {
  items: InventoryMetric[];
  totalValueCents: number;
  noStockCount: number;
  productValueCents: number;
  insumoValueCents: number;
  ingredienteValueCents: number;
}

export function buildInventorySummary(
  products: Product[],
  insumos: Insumo[],
  ingredientes: Ingrediente[]
): InventorySummary {
  const insumosById = toInsumosMap(insumos);
  const ingredientesById = toIngredientesMap(ingredientes);
  const items: InventoryMetric[] = [];

  for (const product of products) {
    const unitCostCents = resolveProductCost(
      product.recipeItems ?? [],
      insumosById,
      ingredientesById,
      product.yieldQuantity || 1,
      getProductExtraCost(product)
    );
    const quantity = Number(product.stockQuantity ?? 0);
    const stockValueCents = Math.round(quantity * unitCostCents);
    items.push({
      id: product.id,
      name: product.name,
      kind: "produto",
      unit: product.unit,
      quantity,
      unitCostCents,
      stockValueCents,
      active: product.active,
      noStock: quantity <= 0,
    });
  }

  for (const insumo of insumos) {
    const quantity = Number(insumo.stockQuantity ?? 0);
    const unitCostCents = Number(insumo.unitCostCents ?? 0);
    items.push({
      id: insumo.id,
      name: insumo.name,
      kind: "insumo",
      unit: insumo.unit,
      quantity,
      unitCostCents,
      stockValueCents: Math.round(quantity * unitCostCents),
      active: insumo.active,
      noStock: quantity <= 0,
    });
  }

  for (const ingrediente of ingredientes) {
    const quantity = Number(ingrediente.stockQuantity ?? 0);
    const unitCostCents = Number(ingrediente.unitCostCents ?? 0);
    items.push({
      id: ingrediente.id,
      name: ingrediente.name,
      kind: "ingrediente",
      unit: ingrediente.yieldUnit,
      quantity,
      unitCostCents,
      stockValueCents: Math.round(quantity * unitCostCents),
      active: ingrediente.active,
      noStock: quantity <= 0,
    });
  }

  const activeItems = items.filter((item) => item.active);
  const productValueCents = activeItems
    .filter((item) => item.kind === "produto")
    .reduce((sum, item) => sum + item.stockValueCents, 0);
  const insumoValueCents = activeItems
    .filter((item) => item.kind === "insumo")
    .reduce((sum, item) => sum + item.stockValueCents, 0);
  const ingredienteValueCents = activeItems
    .filter((item) => item.kind === "ingrediente")
    .reduce((sum, item) => sum + item.stockValueCents, 0);

  return {
    items,
    totalValueCents: productValueCents + insumoValueCents + ingredienteValueCents,
    noStockCount: activeItems.filter((item) => item.noStock).length,
    productValueCents,
    insumoValueCents,
    ingredienteValueCents,
  };
}

export interface InsumoConsumption {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  estimatedCostCents: number;
}

function accumulateIngredientInsumos(
  ingrediente: Ingrediente,
  ingredientsById: Map<string, Ingrediente>,
  insumosById: Map<string, Insumo>,
  factor: number,
  output: Map<string, number>,
  visiting = new Set<string>()
): void {
  if (visiting.has(ingrediente.id) || ingrediente.yieldQuantity <= 0) return;
  visiting.add(ingrediente.id);

  for (const item of ingrediente.recipeItems ?? []) {
    if (item.sourceType === "insumo") {
      if (insumosById.has(item.sourceId)) {
        output.set(
          item.sourceId,
          (output.get(item.sourceId) ?? 0) + (Number(item.quantity ?? 0) / ingrediente.yieldQuantity) * factor
        );
      }
      continue;
    }

    const sub = ingredientsById.get(item.sourceId);
    if (sub) {
      accumulateIngredientInsumos(
        sub,
        ingredientsById,
        insumosById,
        factor * (Number(item.quantity ?? 0) / ingrediente.yieldQuantity),
        output,
        visiting
      );
    }
  }

  visiting.delete(ingrediente.id);
}

export function estimateInsumoConsumption(
  sales: RawSale[],
  products: Product[],
  insumos: Insumo[],
  ingredientes: Ingrediente[]
): InsumoConsumption[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const insumosById = toInsumosMap(insumos);
  const ingredientesById = toIngredientesMap(ingredientes);
  const consumption = new Map<string, number>();

  for (const sale of sales) {
    for (const item of sale.items) {
      const product = productById.get(item.productId);
      if (!product || (product.yieldQuantity ?? 1) <= 0) continue;

      const factorPerUnit = 1 / (product.yieldQuantity || 1);
      for (const recipeItem of product.recipeItems ?? []) {
        if (recipeItem.sourceType === "insumo") {
          if (insumosById.has(recipeItem.sourceId)) {
            consumption.set(
              recipeItem.sourceId,
              (consumption.get(recipeItem.sourceId) ?? 0) +
                (Number(recipeItem.quantity ?? 0) * factorPerUnit * item.quantity)
            );
          }
        } else {
          const ingredient = ingredientesById.get(recipeItem.sourceId);
          if (ingredient) {
            accumulateIngredientInsumos(
              ingredient,
              ingredientesById,
              insumosById,
              Number(recipeItem.quantity ?? 0) * factorPerUnit * item.quantity,
              consumption
            );
          }
        }
      }
    }
  }

  return Array.from(consumption.entries())
    .map(([id, quantity]) => {
      const insumo = insumosById.get(id);
      if (!insumo) return null;
      return {
        id,
        name: insumo.name,
        unit: insumo.unit,
        quantity,
        estimatedCostCents: Math.round(quantity * Number(insumo.unitCostCents ?? 0)),
      };
    })
    .filter((value): value is InsumoConsumption => Boolean(value))
    .sort((a, b) => b.estimatedCostCents - a.estimatedCostCents);
}

export interface AbcItem extends ProductPerformance {
  sharePct: number;
  accumulatedPct: number;
  className: "A" | "B" | "C";
}

export function buildAbc(
  performance: ProductPerformance[],
  mode: "faturamento" | "lucro" | "quantidade"
): AbcItem[] {
  const sorted = [...performance]
    .filter((item) =>
      mode === "faturamento"
        ? item.revenueCents > 0
        : mode === "lucro"
          ? item.profitCents > 0
          : item.quantity > 0
    )
    .sort((a, b) => {
      const av =
        mode === "faturamento"
          ? a.revenueCents
          : mode === "lucro"
            ? a.profitCents
            : a.quantity;
      const bv =
        mode === "faturamento"
          ? b.revenueCents
          : mode === "lucro"
            ? b.profitCents
            : b.quantity;
      return bv - av;
    });

  const total = sorted.reduce(
    (sum, item) =>
      sum +
      (mode === "faturamento"
        ? item.revenueCents
        : mode === "lucro"
          ? item.profitCents
          : item.quantity),
    0
  );

  let accumulated = 0;
  return sorted.map((item) => {
    const value =
      mode === "faturamento"
        ? item.revenueCents
        : mode === "lucro"
          ? item.profitCents
          : item.quantity;
    const sharePct = total > 0 ? (value / total) * 100 : 0;
    accumulated += sharePct;

    return {
      ...item,
      sharePct,
      accumulatedPct: accumulated,
      className: accumulated <= 80 ? "A" : accumulated <= 95 ? "B" : "C",
    };
  });
}

export interface ProductionSummary {
  openOrders: number;
  finalizedOrders: number;
  canceledOrders: number;
  pendingValueCents: number;
  nextDueDate: string | null;
  nextDueOrders: number;
  upcomingItems: {
    date: string;
    customerName: string;
    quantity: number;
    productName: string;
  }[];
}

export function buildProductionSummary(
  orders: RawOrder[],
  products?: Product[]
): ProductionSummary {
  const productNameById = new Map((products ?? []).map((product) => [product.id, product.name]));
  const nonCanceled = orders.filter((order) => order.status !== "cancelada");
  const open = nonCanceled.filter((order) => order.status === "em_producao");
  const finalized = nonCanceled.filter((order) => order.status === "finalizada");
  const canceled = orders.filter((order) => order.status === "cancelada");

  const upcoming = [...open]
    .filter((order) => Boolean(order.expectedDate))
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  const nextDueDate = upcoming[0]?.expectedDate ?? null;
  const nextDueOrders = nextDueDate
    ? upcoming.filter((order) => order.expectedDate === nextDueDate).length
    : 0;

  const upcomingItems = upcoming
    .slice(0, 20)
    .flatMap((order) =>
      order.items.map((item) => ({
        date: order.expectedDate,
        customerName: order.customerName,
        quantity: item.quantity,
        productName: productNameById.get(item.productId) ?? item.productName,
      }))
    );

  return {
    openOrders: open.length,
    finalizedOrders: finalized.length,
    canceledOrders: canceled.length,
    pendingValueCents: open.reduce((sum, order) => sum + order.pendingCents, 0),
    nextDueDate,
    nextDueOrders,
    upcomingItems,
  };
}

export function projectPeriodRevenue(
  sales: RawSale[],
  period: Period
): { projectedCents: number; isProjection: boolean; elapsedDays: number; totalDays: number } {
  const now = new Date();
  const totalDays = Math.max(
    1,
    Math.ceil((period.end.getTime() - period.start.getTime()) / 86400000)
  );
  if (period.start > now || period.end <= now) {
    return {
      projectedCents: summarizeSales(sales).faturamentoLiquidoCents,
      isProjection: false,
      elapsedDays: totalDays,
      totalDays,
    };
  }

  const effectiveEnd = now < period.end ? now : period.end;
  const elapsedDays = Math.max(
    1,
    Math.ceil((effectiveEnd.getTime() - period.start.getTime()) / 86400000)
  );
  const currentRevenue = summarizeSales(
    sales.filter((sale) => sale.createdAt < effectiveEnd)
  ).faturamentoLiquidoCents;

  return {
    projectedCents: Math.round((currentRevenue / elapsedDays) * totalDays),
    isProjection: true,
    elapsedDays,
    totalDays,
  };
}

export interface MonthlyEvolutionLegacy {
  label: string;
  faturamentoCents: number;
  ticketMedioCents: number;
  quantidadeVendas: number;
}

export function buildWhatsAppSummary(
  period: Period,
  summary: SalesSummary,
  topProducts: ProductRanking[]
): string {
  const formatCents = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const lines = [
    "📊 *Resumo de Vendas*",
    "📅 " + period.label,
    "",
    "💰 Vendas líquidas: " + formatCents(summary.faturamentoLiquidoCents),
    "🏷️ Descontos: " + formatCents(summary.discountCents),
    "✅ Recebido: " + formatCents(summary.recebidoCents),
    "⏳ Pendente: " + formatCents(summary.pendenteCents),
    "",
    "🛍️ " +
      summary.quantidadeVendas +
      (summary.quantidadeVendas === 1 ? " venda" : " vendas"),
  ];

  if (topProducts.length > 0) {
    lines.push("", "*Produtos mais vendidos:*");
    topProducts.slice(0, 3).forEach((product, index) =>
      lines.push(String(index + 1) + ". " + product.name)
    );
  }

  return lines.join("\n");
}

// Mantido para compatibilidade com a implementação anterior.
export function legacyMonthlyEvolution(
  allSales: RawSale[],
  monthsBack = 6
): MonthlyEvolutionLegacy[] {
  return computeMonthlyEvolution(allSales, monthsBack).map((month) => ({
    label: month.label,
    faturamentoCents: month.faturamentoCents,
    ticketMedioCents: month.ticketMedioCents,
    quantidadeVendas: month.quantidadeVendas,
  }));
}
