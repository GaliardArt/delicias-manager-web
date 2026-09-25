import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db } from "./config";
import { Customer, Product } from "@/types";

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

// Uma única leitura da coleção `sales` — tudo o mais (período, comparações,
// tendências) é calculado em memória a partir daqui. Simples e correto para o
// volume de uma confeitaria pequena; se a base de vendas crescer muito, vale
// revisar isso com consultas por período em vez de trazer tudo (seção 28 —
// mudança de arquitetura, discutir antes de implementar, seção 31).
export async function getAllSalesRaw(): Promise<RawSale[]> {
  const snapshot = await getDocs(collection(db, "sales"));
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
      customerId: data.customerId,
      customerName: data.customerName,
      subtotalCents: Number(data.subtotalCents ?? fallbackSubtotalCents),
      discountCents: Number(data.discountCents ?? 0),
      totalCents: Number(data.totalCents ?? fallbackSubtotalCents),
      paidCents: data.paidCents,
      pendingCents: data.pendingCents,
      createdAt,
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitCostCents: item.unitCostCents ?? 0,
        totalCents: item.totalCents,
      })),
    };
  });
}

export type PeriodKey = "hoje" | "semana" | "mes" | "personalizado";

export interface Period {
  key: PeriodKey;
  label: string;
  start: Date;
  end: Date; // exclusivo
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function getPeriodPreset(key: Exclude<PeriodKey, "personalizado">): Period {
  const today = startOfDay(new Date());
  const end = new Date(today);
  end.setDate(end.getDate() + 1);

  if (key === "hoje") {
    return { key, label: "Hoje", start: today, end };
  }
  if (key === "semana") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { key, label: "Últimos 7 dias", start, end };
  }
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return { key, label: "Últimos 30 dias", start, end };
}

export function getCustomPeriod(startStr: string, endStr: string): Period {
  const start = startOfDay(new Date(startStr + "T00:00:00"));
  const end = startOfDay(new Date(endStr + "T00:00:00"));
  end.setDate(end.getDate() + 1);
  return { key: "personalizado", label: "Período personalizado", start, end };
}

// A janela imediatamente anterior, do mesmo tamanho — usada para comparação
// nas Tendências.
export function getPreviousPeriod(period: Period): Period {
  const lengthMs = period.end.getTime() - period.start.getTime();
  const end = new Date(period.start);
  const start = new Date(period.start.getTime() - lengthMs);
  return { key: period.key, label: "Período anterior", start, end };
}

export function filterByPeriod(sales: RawSale[], period: Period): RawSale[] {
  return sales.filter((s) => s.createdAt >= period.start && s.createdAt < period.end);
}

export interface SalesSummary {
  faturamentoCents: number;
  recebidoCents: number;
  pendenteCents: number;
  quantidadeVendas: number;
  ticketMedioCents: number;
  custoCents: number;
  lucroBrutoCents: number;
}

export function summarizeSales(sales: RawSale[]): SalesSummary {
  const faturamentoCents = sales.reduce((s, v) => s + v.totalCents, 0);
  const recebidoCents = sales.reduce((s, v) => s + v.paidCents, 0);
  const pendenteCents = sales.reduce((s, v) => s + v.pendingCents, 0);
  const quantidadeVendas = sales.length;
  const ticketMedioCents = quantidadeVendas > 0 ? Math.round(faturamentoCents / quantidadeVendas) : 0;
  const custoCents = sales.reduce(
    (s, v) => s + v.items.reduce((si, item) => si + item.unitCostCents * item.quantity, 0),
    0
  );
  const lucroBrutoCents = faturamentoCents - custoCents;
  return {
    faturamentoCents,
    recebidoCents,
    pendenteCents,
    quantidadeVendas,
    ticketMedioCents,
    custoCents,
    lucroBrutoCents,
  };
}

export interface ProductRanking {
  name: string;
  quantity: number;
  revenueCents: number;
}

export function summarizeProducts(
  sales: RawSale[],
  activeProducts: Product[]
): { topSelling: ProductRanking[]; leastSelling: ProductRanking[] } {
  const map = new Map<string, ProductRanking>();
  for (const product of activeProducts) {
    map.set(product.id, { name: product.name, quantity: 0, revenueCents: 0 });
  }
  for (const sale of sales) {
    for (const item of sale.items) {
      const entry = map.get(item.productId) ?? {
        name: item.productName,
        quantity: 0,
        revenueCents: 0,
      };
      entry.quantity += item.quantity;
      entry.revenueCents += item.totalCents;
      map.set(item.productId, entry);
    }
  }
  const all = Array.from(map.values());
  const sold = all.filter((p) => p.quantity > 0);
  const topSelling = [...sold].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const leastSelling = [...all].sort((a, b) => a.quantity - b.quantity).slice(0, 5);
  return { topSelling, leastSelling };
}

export interface CustomerRanking {
  name: string;
  totalCents: number;
  purchaseCount: number;
}

export function summarizeTopCustomers(sales: RawSale[]): CustomerRanking[] {
  const map = new Map<string, CustomerRanking>();
  for (const sale of sales) {
    if (!sale.customerId) continue; // venda avulsa — não é um cliente cadastrado para ranquear
    const entry = map.get(sale.customerId) ?? {
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

// Global (todo o histórico) — saldo devedor atual por cliente, sem recorte de período.
export function summarizePendingCustomers(allSales: RawSale[]): CustomerRanking[] {
  const map = new Map<string, CustomerRanking>();
  for (const sale of allSales) {
    if (!sale.customerId) continue; // venda avulsa — sem cadastro para cobrar depois
    if (sale.pendingCents <= 0) continue;
    const entry = map.get(sale.customerId) ?? {
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
  name: string;
  phone: string;
  lastPurchaseAt: string | null;
}

// Clientes ativos sem compra nos últimos `thresholdDays` dias (ou nunca compraram).
export function findInactiveCustomers(
  allSales: RawSale[],
  activeCustomers: Customer[],
  thresholdDays = 30
): InactiveCustomer[] {
  const lastPurchase = new Map<string, Date>();
  for (const sale of allSales) {
    const current = lastPurchase.get(sale.customerId);
    if (!current || sale.createdAt > current) {
      lastPurchase.set(sale.customerId, sale.createdAt);
    }
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);

  return activeCustomers
    .filter((c) => {
      const last = lastPurchase.get(c.id);
      return !last || last < cutoff;
    })
    .map((c) => ({
      name: c.name,
      phone: c.phone,
      lastPurchaseAt: lastPurchase.get(c.id)?.toISOString() ?? null,
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

  const curSummary = summarizeSales(current);
  const prevSummary = summarizeSales(previous);

  const revenueChangePct =
    prevSummary.faturamentoCents > 0
      ? ((curSummary.faturamentoCents - prevSummary.faturamentoCents) / prevSummary.faturamentoCents) * 100
      : null;
  const ticketChangePct =
    prevSummary.ticketMedioCents > 0
      ? ((curSummary.ticketMedioCents - prevSummary.ticketMedioCents) / prevSummary.ticketMedioCents) * 100
      : null;

  const weekdayCounts = new Array(7).fill(0);
  for (const sale of current) weekdayCounts[sale.createdAt.getDay()] += 1;
  const maxCount = Math.max(...weekdayCounts);
  const busiestWeekday = maxCount > 0 ? weekdayNames[weekdayCounts.indexOf(maxCount)] ?? null : null;

  const curQty = new Map<string, number>();
  const prevQty = new Map<string, number>();
  for (const sale of current)
    for (const item of sale.items)
      curQty.set(item.productName, (curQty.get(item.productName) ?? 0) + item.quantity);
  for (const sale of previous)
    for (const item of sale.items)
      prevQty.set(item.productName, (prevQty.get(item.productName) ?? 0) + item.quantity);

  const productNames = new Set([...curQty.keys(), ...prevQty.keys()]);
  const deltas = Array.from(productNames).map((name) => ({
    name,
    delta: (curQty.get(name) ?? 0) - (prevQty.get(name) ?? 0),
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

export interface MonthlyEvolution {
  label: string;
  faturamentoCents: number;
  ticketMedioCents: number;
  quantidadeVendas: number;
}

// Evolução dos últimos `monthsBack` meses (seção 16: "evolução do ticket médio",
// seção 30 Fase 8: "tendências"). Meses sem nenhuma venda aparecem com zero —
// dado real, não omitido.
export function computeMonthlyEvolution(allSales: RawSale[], monthsBack = 6): MonthlyEvolution[] {
  const months: MonthlyEvolution[] = [];
  const now = new Date();

  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const inMonth = allSales.filter((s) => s.createdAt >= monthStart && s.createdAt < monthEnd);
    const summary = summarizeSales(inMonth);
    months.push({
      label: monthStart.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      faturamentoCents: summary.faturamentoCents,
      ticketMedioCents: summary.ticketMedioCents,
      quantidadeVendas: summary.quantidadeVendas,
    });
  }

  return months;
}

export interface CustomerBehavior {
  newCustomers: number;
  returningCustomers: number;
}

// Comportamento de clientes no período (seção 30 Fase 8): quantos são novos
// (primeira compra de todos os tempos caiu dentro do período) vs recorrentes
// (já tinham comprado antes e voltaram a comprar no período).
export function computeCustomerBehavior(allSales: RawSale[], period: Period): CustomerBehavior {
  const registeredSales = allSales.filter((s) => s.customerId); // exclui vendas avulsas
  const firstPurchase = new Map<string, Date>();
  for (const sale of registeredSales) {
    const current = firstPurchase.get(sale.customerId);
    if (!current || sale.createdAt < current) {
      firstPurchase.set(sale.customerId, sale.createdAt);
    }
  }

  const customersInPeriod = new Set(
    registeredSales
      .filter((s) => s.createdAt >= period.start && s.createdAt < period.end)
      .map((s) => s.customerId)
  );

  let newCustomers = 0;
  let returningCustomers = 0;
  for (const customerId of customersInPeriod) {
    const first = firstPurchase.get(customerId);
    if (first && first >= period.start && first < period.end) {
      newCustomers += 1;
    } else {
      returningCustomers += 1;
    }
  }

  return { newCustomers, returningCustomers };
}

export function buildWhatsAppSummary(
  period: Period,
  summary: SalesSummary,
  topProducts: ProductRanking[]
): string {
  const formatCents = (c: number) =>
    (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const lines = [
    `📊 *Resumo de Vendas*`,
    `📅 ${period.label}`,
    ``,
    `💰 Vendas: ${formatCents(summary.faturamentoCents)}`,
    `✅ Recebido: ${formatCents(summary.recebidoCents)}`,
    `⏳ Pendente: ${formatCents(summary.pendenteCents)}`,
    ``,
    `🛍️ ${summary.quantidadeVendas} ${summary.quantidadeVendas === 1 ? "venda" : "vendas"}`,
  ];

  if (topProducts.length > 0) {
    lines.push(``, `*Produtos mais vendidos:*`);
    topProducts.slice(0, 3).forEach((p, i) => lines.push(`${i + 1}. ${p.name}`));
  }

  return lines.join("\n");
}
