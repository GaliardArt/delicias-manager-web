"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  Boxes,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  DollarSign,
  Download,
  Factory,
  MessageCircle,
  Package,
  Percent,
  Printer,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { listAllProducts } from "@/lib/firebase/products";
import { listAllCustomers } from "@/lib/firebase/customers";
import { listAllExpenses } from "@/lib/firebase/expenses";
import { listAllInsumos } from "@/lib/firebase/insumos";
import { listAllIngredientes } from "@/lib/firebase/ingredientes";
import {
  AbcItem,
  buildAbc,
  buildCustomerMetrics,
  buildDailyMetrics,
  buildExpenseCategories,
  buildInventorySummary,
  buildProductionSummary,
  buildProductPerformance,
  buildReceivableAging,
  buildWeekdayMetrics,
  computeCustomerBehavior,
  computeMonthlyEvolution,
  computeTrends,
  estimateInsumoConsumption,
  filterByPeriod,
  getCustomPeriod,
  getPeriodPreset,
  getPreviousPeriod,
  getAllOrdersRaw,
  getAllSalesRaw,
  ProductPerformance,
  PeriodKey,
  projectPeriodRevenue,
  RawOrder,
  RawSale,
  summarizePendingCustomers,
  summarizeSales,
} from "@/lib/firebase/reports";
import { Customer, Expense, Ingrediente, Insumo, Product } from "@/types";
import { formatCurrencyBRL, formatDateBR, todayLocalIso } from "@/lib/utils/format";

type ReportTab =
  | "visao"
  | "vendas"
  | "produtos"
  | "clientes"
  | "financeiro"
  | "estoque"
  | "abc";

const tabs: { id: ReportTab; label: string }[] = [
  { id: "visao", label: "Visão Geral" },
  { id: "vendas", label: "Vendas" },
  { id: "produtos", label: "Produtos" },
  { id: "clientes", label: "Clientes" },
  { id: "financeiro", label: "Financeiro" },
  { id: "estoque", label: "Estoque / Produção" },
  { id: "abc", label: "Curva ABC" },
];

function pct(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function signedPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return sign + value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

function numberBR(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function safeDividePct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  detail?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success-700"
      : tone === "warning"
        ? "text-warning-700"
        : tone === "danger"
          ? "text-danger-700"
          : "text-ink";

  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">{label}</p>
          <p className={"mt-1 truncate font-display text-xl font-semibold " + toneClass}>{value}</p>
          {detail && <p className="mt-1 text-xs text-ink-faint">{detail}</p>}
        </div>
        <div className="rounded-xl bg-surface-muted p-2 text-ink-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function Delta({ value, label = "" }: { value: number | null; label?: string }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-xs text-ink-faint">sem comparação</span>;
  }
  const positive = value > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={"inline-flex items-center gap-1 text-xs " + (positive ? "text-success-700" : "text-danger-700")}>
      <Icon className="h-3.5 w-3.5" />
      {signedPct(value)}{label ? " " + label : ""}
    </span>
  );
}

function HorizontalBars({
  values,
  empty = "Sem dados.",
}: {
  values: { label: string; value: number; display?: string }[];
  empty?: string;
}) {
  const max = Math.max(...values.map((item) => Math.abs(item.value)), 0);
  if (values.length === 0) {
    return <p className="text-sm text-ink-muted">{empty}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {values.map((item) => {
        const width = max > 0 ? Math.max(3, (Math.abs(item.value) / max) * 100) : 0;
        return (
          <div key={item.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 text-xs sm:grid-cols-[140px_1fr_auto]">
            <span className="truncate text-ink-muted">{item.label}</span>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-brand-400" style={{ width: width + "%" }} />
            </div>
            <span className="whitespace-nowrap font-medium text-ink">{item.display ?? numberBR(item.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function VerticalBars({
  values,
  valueKey = "value",
  formatValue,
}: {
  values: { label: string; value: number; secondary?: number }[];
  valueKey?: string;
  formatValue?: (value: number) => string;
}) {
  void valueKey;
  if (values.length === 0) return <p className="text-sm text-ink-muted">Sem dados para o período.</p>;
  const max = Math.max(...values.map((item) => Math.max(0, item.value)), 0);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-end gap-1 border-b border-line px-1 pt-2" style={{ height: 220 }}>
        {values.map((item) => {
          const height = max > 0 ? Math.max(5, (Math.max(0, item.value) / max) * 175) : 5;
          return (
            <div key={item.label} className="flex w-8 flex-col items-center justify-end gap-1">
              <div className="text-[9px] text-ink-faint">
                {formatValue ? formatValue(item.value) : numberBR(item.value)}
              </div>
              <div
                className="w-full rounded-t-md bg-brand-400"
                style={{ height }}
                title={item.label + ": " + (formatValue ? formatValue(item.value) : numberBR(item.value))}
              />
              <div className="w-10 -rotate-45 origin-top-right truncate pt-1 text-[9px] text-ink-faint">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  empty = "Sem dados.",
}: {
  headers: string[];
  rows: (string | number | ReactNode)[][];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-ink-muted">
          {headers.map((header) => (
            <th key={header} className="px-2 py-2 font-medium first:pl-0 last:pr-0">
              {header}
            </th>
          ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-2 py-2.5 first:pl-0 last:pr-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader className="mb-4">
      <div>
        <CardTitle>{title}</CardTitle>
        {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
      </div>
      {action}
    </CardHeader>
  );
}

function getKindLabel(kind: "produto" | "insumo" | "ingrediente"): string {
  return kind === "produto" ? "Produto" : kind === "insumo" ? "Insumo" : "Ingrediente";
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const body = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => '"' + String(value ?? "").replace(/"/g, '""') + '"')
        .join(";")
    )
    .join("\n");

  const blob = new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPage() {
  const [sales, setSales] = useState<RawSale[] | null>(null);
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<ReportTab>("visao");
  const [periodKey, setPeriodKey] = useState<PeriodKey>("mes_atual");
  const [customStart, setCustomStart] = useState(todayLocalIso());
  const [customEnd, setCustomEnd] = useState(todayLocalIso());
  const [copied, setCopied] = useState(false);
  const [abcMode, setAbcMode] = useState<"faturamento" | "lucro" | "quantidade">("faturamento");

  async function load() {
    setError(false);
    setSales(null);
    try {
      const [salesResult, ordersResult, productsResult, customersResult, expensesResult, insumosResult, ingredientesResult] =
        await Promise.all([
          getAllSalesRaw(),
          getAllOrdersRaw(),
          listAllProducts(),
          listAllCustomers(),
          listAllExpenses(),
          listAllInsumos(),
          listAllIngredientes(),
        ]);

      setSales(salesResult);
      setOrders(ordersResult);
      setProducts(productsResult);
      setCustomers(customersResult);
      setExpenses(expensesResult);
      setInsumos(insumosResult);
      setIngredientes(ingredientesResult);
    } catch (loadError) {
      console.error(loadError);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const period = useMemo(
    () =>
      periodKey === "personalizado"
        ? getCustomPeriod(customStart, customEnd)
        : getPeriodPreset(periodKey),
    [periodKey, customStart, customEnd]
  );

  const previousPeriod = useMemo(() => getPreviousPeriod(period), [period]);
  const current = useMemo(() => (sales ? filterByPeriod(sales, period) : []), [sales, period]);
  const previous = useMemo(() => (sales ? filterByPeriod(sales, previousPeriod) : []), [sales, previousPeriod]);

  const summary = useMemo(() => summarizeSales(current), [current]);
  const previousSummary = useMemo(() => summarizeSales(previous), [previous]);
  const trends = useMemo(() => computeTrends(current, previous), [current, previous]);
  const monthlyEvolution = useMemo(() => (sales ? computeMonthlyEvolution(sales, 6) : []), [sales]);
  const dailyMetrics = useMemo(() => buildDailyMetrics(current, period), [current, period]);
  const weekdayMetrics = useMemo(() => buildWeekdayMetrics(current), [current]);

  const periodExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        const date = new Date(expense.date + "T00:00:00");
        return date >= period.start && date < period.end;
      }),
    [expenses, period]
  );

  const previousExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        const date = new Date(expense.date + "T00:00:00");
        return date >= previousPeriod.start && date < previousPeriod.end;
      }),
    [expenses, previousPeriod]
  );

  const expensesCents = useMemo(
    () => periodExpenses.reduce((sum, expense) => sum + Number(expense.amountCents ?? 0), 0),
    [periodExpenses]
  );

  const previousExpensesCents = useMemo(
    () => previousExpenses.reduce((sum, expense) => sum + Number(expense.amountCents ?? 0), 0),
    [previousExpenses]
  );

  const lucroLiquidoCents = summary.lucroBrutoCents - expensesCents;
  const previousLucroLiquidoCents = previousSummary.lucroBrutoCents - previousExpensesCents;
  const margemLiquidaPct = safeDividePct(lucroLiquidoCents, summary.faturamentoLiquidoCents);
  const previousMargemLiquidaPct = safeDividePct(
    previousLucroLiquidoCents,
    previousSummary.faturamentoLiquidoCents
  );

  const productPerformance = useMemo(
    () => buildProductPerformance(current, previous, products),
    [current, previous, products]
  );

  const productsByRevenue = useMemo(
    () => [...productPerformance].filter((item) => item.revenueCents > 0).sort((a, b) => b.revenueCents - a.revenueCents),
    [productPerformance]
  );

  const productsByProfit = useMemo(
    () => [...productPerformance].filter((item) => item.revenueCents > 0).sort((a, b) => b.profitCents - a.profitCents),
    [productPerformance]
  );

  const productsByQuantity = useMemo(
    () => [...productPerformance].filter((item) => item.quantity > 0).sort((a, b) => b.quantity - a.quantity),
    [productPerformance]
  );

  const productsByMargin = useMemo(
    () =>
      [...productPerformance]
        .filter((item) => item.quantity > 0 && item.marginPct !== null)
        .sort((a, b) => (b.marginPct ?? -Infinity) - (a.marginPct ?? -Infinity)),
    [productPerformance]
  );

  const customerMetrics = useMemo(
    () => (sales ? buildCustomerMetrics(current, sales, customers) : []),
    [current, sales, customers]
  );

  const customersByRevenue = useMemo(
    () => [...customerMetrics].sort((a, b) => b.totalCents - a.totalCents),
    [customerMetrics]
  );

  const customersByPurchases = useMemo(
    () => [...customerMetrics].sort((a, b) => b.purchaseCount - a.purchaseCount),
    [customerMetrics]
  );

  const pendingCustomers = useMemo(
    () => (sales ? summarizePendingCustomers(sales) : []),
    [sales]
  );

  const inactiveCustomers = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);
    const lastByCustomer = new Map<string, Date>();

    for (const sale of sales ?? []) {
      if (!sale.customerId) continue;
      const currentDate = lastByCustomer.get(sale.customerId);
      if (!currentDate || sale.createdAt > currentDate) lastByCustomer.set(sale.customerId, sale.createdAt);
    }

    return customers
      .filter((customer) => customer.active)
      .map((customer) => ({
        ...customer,
        lastPurchase: lastByCustomer.get(customer.id) ?? null,
      }))
      .filter((customer) => !customer.lastPurchase || customer.lastPurchase < cutoff)
      .sort((a, b) => {
        const left = a.lastPurchase?.getTime() ?? 0;
        const right = b.lastPurchase?.getTime() ?? 0;
        return left - right;
      });
  }, [customers, sales]);

  const customerBehavior = useMemo(
    () =>
      sales
        ? computeCustomerBehavior(sales, period)
        : { newCustomers: 0, returningCustomers: 0 },
    [sales, period]
  );

  const concentration = useMemo(() => {
    const total = customersByRevenue.reduce((sum, customer) => sum + customer.totalCents, 0);
    const share = (count: number) =>
      total > 0
        ? (customersByRevenue.slice(0, count).reduce((sum, customer) => sum + customer.totalCents, 0) / total) * 100
        : 0;
    return {
      top5Pct: share(5),
      top10Pct: share(10),
      top20Pct: share(20),
    };
  }, [customersByRevenue]);

  const aging = useMemo(() => (sales ? buildReceivableAging(sales) : []), [sales]);
  const totalReceivableCents = useMemo(
    () => aging.reduce((sum, bucket) => sum + bucket.amountCents, 0),
    [aging]
  );

  const inventory = useMemo(
    () => buildInventorySummary(products, insumos, ingredientes),
    [products, insumos, ingredientes]
  );

  const currentProductCostById = useMemo(
    () =>
      new Map(
        inventory.items
          .filter((item) => item.kind === "produto")
          .map((item) => [item.id, item.unitCostCents])
      ),
    [inventory]
  );

  const consumption = useMemo(
    () => estimateInsumoConsumption(current, products, insumos, ingredientes),
    [current, products, insumos, ingredientes]
  );

  const production = useMemo(() => buildProductionSummary(orders, products), [orders, products]);
  const abc = useMemo(() => buildAbc(productPerformance, abcMode), [productPerformance, abcMode]);

  const expenseCategories = useMemo(
    () => buildExpenseCategories(periodExpenses, expensesCents),
    [periodExpenses, expensesCents]
  );

  const projection = useMemo(() => (sales ? projectPeriodRevenue(current, period) : null), [current, period, sales]);

  const alerts = useMemo(() => {
    const result: string[] = [];
    if (trends.revenueChangePct !== null && trends.revenueChangePct <= -10) {
      result.push("O faturamento líquido caiu " + Math.abs(trends.revenueChangePct).toFixed(1) + "% em relação ao período anterior.");
    }
    if (previousExpensesCents > 0 && expensesCents > previousExpensesCents * 1.1) {
      const change = ((expensesCents - previousExpensesCents) / previousExpensesCents) * 100;
      result.push("As despesas aumentaram " + change.toFixed(1) + "% em relação ao período anterior.");
    }
    if (summary.descontoPct !== null && summary.descontoPct >= 5) {
      result.push("Os descontos representam " + summary.descontoPct.toFixed(1) + "% do faturamento bruto no período.");
    }
    if (summary.pendenteCents > 0) {
      result.push("Existem " + formatCurrencyBRL(summary.pendenteCents) + " pendentes nas vendas selecionadas.");
    }
    const lowMargin = productPerformance.filter(
      (item) => item.quantity >= 3 && item.marginPct !== null && item.marginPct < 20
    );
    if (lowMargin.length > 0) {
      result.push(lowMargin.length + " produto" + (lowMargin.length > 1 ? "s" : "") + " com margem abaixo de 20% no período.");
    }
    if (inventory.noStockCount > 0) {
      result.push(inventory.noStockCount + " item" + (inventory.noStockCount > 1 ? "s" : "") + " ativo" + (inventory.noStockCount > 1 ? "s" : "") + " está" + (inventory.noStockCount > 1 ? "ão" : "") + " sem estoque.");
    }
    const oldReceivable = aging.find((bucket) => bucket.label === "+60 dias");
    if (oldReceivable && oldReceivable.amountCents > 0) {
      result.push(formatCurrencyBRL(oldReceivable.amountCents) + " em contas a receber está" + "o" + " com mais de 60 dias.");
    }
    return result;
  }, [aging, expensesCents, inventory.noStockCount, previousExpensesCents, productPerformance, summary, trends.revenueChangePct]);

  const whatsappText = useMemo(() => {
    const lines = [
      "📊 *Relatório gerencial*",
      "📅 " + period.label,
      "",
      "💰 Receita líquida: " + formatCurrencyBRL(summary.faturamentoLiquidoCents),
      "🏷️ Descontos: " + formatCurrencyBRL(summary.discountCents),
      "🧾 CMV: " + formatCurrencyBRL(summary.custoCents),
      "📈 Lucro bruto: " + formatCurrencyBRL(summary.lucroBrutoCents),
      "💸 Despesas: " + formatCurrencyBRL(expensesCents),
      "✅ Lucro líquido: " + formatCurrencyBRL(lucroLiquidoCents),
      "⏳ Pendente nas vendas: " + formatCurrencyBRL(summary.pendenteCents),
      "",
      "🛍️ " + summary.quantidadeVendas + " vendas",
      "🎟️ Ticket médio: " + formatCurrencyBRL(summary.ticketMedioCents),
    ];

    if (productsByQuantity[0]) {
      lines.push("", "🥇 Mais vendido: " + productsByQuantity[0].name);
    }
    return lines.join("\n");
  }, [expensesCents, lucroLiquidoCents, period.label, productsByQuantity, summary]);

  function handleShareWhatsApp() {
    window.open("https://wa.me/?text=" + encodeURIComponent(whatsappText), "_blank");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      console.error(copyError);
    }
  }

  function exportCurrentTab() {
    const filenameBase = "relatorio-" + tab + "-" + period.start.toISOString().slice(0, 10) + "-" + new Date(period.end.getTime() - 86400000).toISOString().slice(0, 10);

    if (tab === "produtos" || tab === "abc") {
      const data = tab === "abc" ? abc : productsByRevenue;
      downloadCsv(
        filenameBase + ".csv",
        ["Produto", "Quantidade", "Receita líquida", "Custo", "Lucro", "Margem", "Classe ABC"],
        data.map((item: ProductPerformance | AbcItem) => [
          item.name,
          item.quantity,
          formatCurrencyBRL(item.revenueCents),
          formatCurrencyBRL(item.costCents),
          formatCurrencyBRL(item.profitCents),
          pct(item.marginPct),
          "className" in item ? item.className : "",
        ])
      );
      return;
    }

    if (tab === "clientes") {
      downloadCsv(
        filenameBase + ".csv",
        ["Cliente", "Compras", "Receita", "Ticket médio", "Pendente", "Descontos", "Primeira compra", "Última compra"],
        customersByRevenue.map((customer) => [
          customer.name,
          customer.purchaseCount,
          formatCurrencyBRL(customer.totalCents),
          formatCurrencyBRL(customer.averageTicketCents),
          formatCurrencyBRL(customer.pendingCents),
          formatCurrencyBRL(customer.discountCents),
          customer.firstPurchaseAt ? formatDateBR(customer.firstPurchaseAt) : "",
          customer.lastPurchaseAt ? formatDateBR(customer.lastPurchaseAt) : "",
        ])
      );
      return;
    }

    if (tab === "financeiro") {
      downloadCsv(
        filenameBase + ".csv",
        ["Categoria", "Valor", "Participação"],
        expenseCategories.map((expense) => [
          expense.category,
          formatCurrencyBRL(expense.amountCents),
          pct(expense.sharePct),
        ])
      );
      return;
    }

    if (tab === "estoque") {
      downloadCsv(
        filenameBase + ".csv",
        ["Tipo", "Item", "Unidade", "Quantidade", "Custo unitário", "Valor em estoque", "Status"],
        inventory.items.map((item) => [
          getKindLabel(item.kind),
          item.name,
          item.unit,
          numberBR(item.quantity),
          formatCurrencyBRL(item.unitCostCents),
          formatCurrencyBRL(item.stockValueCents),
          item.active ? (item.noStock ? "Sem estoque" : "Ativo") : "Inativo",
        ])
      );
      return;
    }

    if (tab === "vendas") {
      downloadCsv(
        filenameBase + ".csv",
        ["Data", "Vendas", "Itens", "Receita líquida", "CMV", "Lucro bruto"],
        dailyMetrics.map((day) => [
          day.date,
          day.quantitySales,
          day.quantityItems,
          formatCurrencyBRL(day.revenueCents),
          formatCurrencyBRL(day.costCents),
          formatCurrencyBRL(day.profitCents),
        ])
      );
      return;
    }

    downloadCsv(
      filenameBase + ".csv",
      ["Indicador", "Valor"],
      [
        ["Receita bruta", formatCurrencyBRL(summary.faturamentoBrutoCents)],
        ["Descontos", formatCurrencyBRL(summary.discountCents)],
        ["Receita líquida", formatCurrencyBRL(summary.faturamentoLiquidoCents)],
        ["CMV", formatCurrencyBRL(summary.custoCents)],
        ["Lucro bruto", formatCurrencyBRL(summary.lucroBrutoCents)],
        ["Despesas", formatCurrencyBRL(expensesCents)],
        ["Lucro líquido", formatCurrencyBRL(lucroLiquidoCents)],
        ["Margem bruta", pct(summary.margemBrutaPct)],
        ["Margem líquida", pct(margemLiquidaPct)],
        ["Vendas", summary.quantidadeVendas],
        ["Ticket médio", formatCurrencyBRL(summary.ticketMedioCents)],
      ]
    );
  }

  if (sales === null && !error) {
    return (
      <AppShell title="Relatórios">
        <div className="flex flex-col gap-3">
          {[...Array(7)].map((_, index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Relatórios">
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar os relatórios"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Relatórios">
      <div className="flex flex-col gap-4">
        <div className="no-print flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              label="Período"
              value={periodKey}
              onChange={(event) => setPeriodKey(event.target.value as PeriodKey)}
              className="sm:w-52"
            >
              <option value="hoje">Hoje</option>
              <option value="semana">Últimos 7 dias</option>
              <option value="mes_atual">Este mês</option>
              <option value="mes">Últimos 30 dias</option>
              <option value="mes_anterior">Mês anterior</option>
              <option value="trimestre">Últimos 90 dias</option>
              <option value="personalizado">Personalizado</option>
            </Select>

            {periodKey === "personalizado" && (
              <>
                <Input
                  label="De"
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                />
                <Input
                  label="Até"
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={load}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="secondary" onClick={exportCurrentTab}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </Button>
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button onClick={handleShareWhatsApp}>
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </div>

        <div className="no-print flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1 shadow-card">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={
                "whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors " +
                (tab === item.id ? "bg-brand-500 text-white" : "text-ink-muted hover:bg-surface-muted hover:text-ink")
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{tabs.find((item) => item.id === tab)?.label}</h2>
            <p className="text-xs text-ink-muted">
              {period.label} · {period.start.toLocaleDateString("pt-BR")} a{" "}
              {new Date(period.end.getTime() - 86400000).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="no-print rounded-full bg-surface-muted px-3 py-1 text-xs text-ink-muted">
            Relatório analítico
          </div>
        </div>

        {tab === "visao" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Faturamento bruto" value={formatCurrencyBRL(summary.faturamentoBrutoCents)} icon={DollarSign} detail={"Antes dos descontos"} />
              <MetricCard label="Descontos" value={formatCurrencyBRL(summary.discountCents)} icon={Percent} detail={summary.descontoPct !== null ? pct(summary.descontoPct) + " do faturamento bruto" : undefined} tone="warning" />
              <MetricCard label="Receita líquida" value={formatCurrencyBRL(summary.faturamentoLiquidoCents)} icon={ShoppingCart} detail={<Delta value={trends.revenueChangePct} />} />
              <MetricCard label="Lucro líquido" value={formatCurrencyBRL(lucroLiquidoCents)} icon={Wallet} detail={<Delta value={previousLucucroDiff()} />} tone={lucroLiquidoCents >= 0 ? "success" : "danger"} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="CMV" value={formatCurrencyBRL(summary.custoCents)} icon={Package} />
              <MetricCard label="Lucro bruto" value={formatCurrencyBRL(summary.lucroBrutoCents)} icon={TrendingUp} tone={summary.lucroBrutoCents >= 0 ? "success" : "danger"} />
              <MetricCard label="Despesas" value={formatCurrencyBRL(expensesCents)} icon={Wallet} tone="danger" detail={<Delta value={previousExpensesCents > 0 ? ((expensesCents - previousExpensesCents) / previousExpensesCents) * 100 : null} />} />
              <MetricCard label="Vendas" value={String(summary.quantidadeVendas)} icon={ShoppingCart} detail={summary.quantidadeItens + " itens vendidos"} />
              <MetricCard label="Ticket médio" value={formatCurrencyBRL(summary.ticketMedioCents)} icon={Receipt} detail={<Delta value={trends.ticketChangePct} />} />
            </div>

            <Card>
              <SectionTitle title="Resultado e caixa" description="O recebido abaixo representa o estado financeiro das vendas selecionadas; não substitui um extrato de pagamentos por data." />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Recebido das vendas" value={formatCurrencyBRL(summary.recebidoCents)} icon={Check} tone="success" />
                <MetricCard label="A receber" value={formatCurrencyBRL(summary.pendenteCents)} icon={Clock3} tone="warning" />
                <MetricCard label="Margem bruta" value={pct(summary.margemBrutaPct)} icon={Percent} />
                <MetricCard label="Margem líquida" value={pct(margemLiquidaPct)} icon={Percent} tone={lucroLiquidoCents >= 0 ? "success" : "danger"} />
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <Card>
                <SectionTitle
                  title="Evolução diária"
                  description="Receita líquida por dia no período."
                />
                <VerticalBars
                  values={dailyMetrics.slice(-31).map((day) => ({ label: day.label, value: day.revenueCents }))}
                  formatValue={formatCurrencyBRL}
                />
              </Card>

              <Card>
                <SectionTitle title="Projeção" description="Estimativa linear baseada na média diária do período atual." />
                {projection?.isProjection ? (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-2xl bg-surface-muted p-4">
                      <p className="text-xs text-ink-muted">Receita projetada até o fim do período</p>
                      <p className="mt-1 font-display text-2xl font-semibold text-ink">
                        {formatCurrencyBRL(projection.projectedCents)}
                      </p>
                    </div>
                    <p className="text-xs text-ink-muted">
                      Base: {formatCurrencyBRL(summary.faturamentoLiquidoCents)} em {projection.elapsedDays} dia(s) considerados, extrapolados para {projection.totalDays} dia(s).
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">
                    Este período já terminou ou começa no futuro. Mostrando apenas valores realizados.
                  </p>
                )}
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Evolução dos últimos 6 meses" />
                <DataTable
                  headers={["Mês", "Receita líquida", "CMV", "Lucro bruto", "Vendas"]}
                  rows={monthlyEvolution.map((month) => [
                    <span className="capitalize" key={month.label}>{month.label}</span>,
                    formatCurrencyBRL(month.faturamentoCents),
                    formatCurrencyBRL(month.custoCents),
                    formatCurrencyBRL(month.lucroBrutoCents),
                    month.quantidadeVendas,
                  ])}
                />
              </Card>

              <Card>
                <SectionTitle title="Pontos de atenção" description="Alertas estatísticos baseados nos dados do período." />
                {alerts.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-2xl bg-surface-muted p-4 text-sm text-ink-muted">
                    <Check className="h-4 w-4 text-success-700" />
                    Nenhum alerta configurado foi disparado no período.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {alerts.map((alert) => (
                      <div key={alert} className="flex items-start gap-2 rounded-2xl bg-surface-muted p-3 text-sm text-ink">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" />
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Produtos em destaque" />
                <DataTable
                  headers={["Indicador", "Produto", "Valor"]}
                  rows={[
                    ["Mais vendido", productsByQuantity[0]?.name ?? "—", productsByQuantity[0] ? numberBR(productsByQuantity[0].quantity) + " un" : "—"],
                    ["Maior faturamento", productsByRevenue[0]?.name ?? "—", productsByRevenue[0] ? formatCurrencyBRL(productsByRevenue[0].revenueCents) : "—"],
                    ["Maior lucro", productsByProfit[0]?.name ?? "—", productsByProfit[0] ? formatCurrencyBRL(productsByProfit[0].profitCents) : "—"],
                    ["Maior margem", productsByMargin[0]?.name ?? "—", productsByMargin[0] ? pct(productsByMargin[0].marginPct) : "—"],
                  ]}
                />
              </Card>

              <Card>
                <SectionTitle title="Clientes e recebíveis" />
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Clientes com compras" value={String(customerMetrics.length)} icon={Users} />
                  <MetricCard label="Novos clientes" value={String(customerBehavior.newCustomers)} icon={Users} />
                  <MetricCard label="Recorrentes" value={String(customerBehavior.returningCustomers)} icon={Users} />
                  <MetricCard label="A receber total" value={formatCurrencyBRL(totalReceivableCents)} icon={Clock3} tone="warning" />
                </div>
                <div className="mt-4">
                  <p className="mb-2 text-xs text-ink-muted">Concentração da receita por clientes</p>
                  <HorizontalBars
                    values={[
                      { label: "Top 5", value: concentration.top5Pct, display: pct(concentration.top5Pct) },
                      { label: "Top 10", value: concentration.top10Pct, display: pct(concentration.top10Pct) },
                      { label: "Top 20", value: concentration.top20Pct, display: pct(concentration.top20Pct) },
                    ]}
                  />
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "vendas" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Receita líquida" value={formatCurrencyBRL(summary.faturamentoLiquidoCents)} icon={DollarSign} detail={<Delta value={trends.revenueChangePct} />} />
              <MetricCard label="Descontos" value={formatCurrencyBRL(summary.discountCents)} icon={Percent} tone="warning" />
              <MetricCard label="Vendas" value={String(summary.quantidadeVendas)} icon={ShoppingCart} />
              <MetricCard label="Itens" value={numberBR(summary.quantidadeItens)} icon={Package} />
              <MetricCard label="Ticket médio" value={formatCurrencyBRL(summary.ticketMedioCents)} icon={DollarSign} detail={<Delta value={trends.ticketChangePct} />} />
            </div>

            <Card>
              <SectionTitle title="Faturamento por dia" description="Receita líquida e quantidade de vendas." />
              <VerticalBars
                values={dailyMetrics.map((day) => ({ label: day.label, value: day.revenueCents }))}
                formatValue={formatCurrencyBRL}
              />
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Movimento por dia da semana" />
                <HorizontalBars
                  values={weekdayMetrics.filter((day) => day.sales > 0).map((day) => ({
                    label: day.label,
                    value: day.revenueCents,
                    display: formatCurrencyBRL(day.revenueCents),
                  }))}
                />
              </Card>

              <Card>
                <SectionTitle title="Ticket médio por dia da semana" />
                <HorizontalBars
                  values={weekdayMetrics.filter((day) => day.sales > 0).map((day) => ({
                    label: day.label,
                    value: day.averageTicketCents,
                    display: formatCurrencyBRL(day.averageTicketCents),
                  }))}
                />
              </Card>
            </div>

            <Card>
              <SectionTitle title="Evolução por dia" description="Dados exportáveis por CSV." />
              <DataTable
                headers={["Data", "Vendas", "Itens", "Receita líquida", "CMV", "Lucro bruto"]}
                rows={dailyMetrics.map((day) => [
                  day.date.split("-").reverse().join("/"),
                  day.quantitySales,
                  day.quantityItems,
                  formatCurrencyBRL(day.revenueCents),
                  formatCurrencyBRL(day.costCents),
                  formatCurrencyBRL(day.profitCents),
                ])}
                empty="Sem vendas no período."
              />
            </Card>
          </div>
        )}

        {tab === "produtos" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Mais vendido" value={productsByQuantity[0]?.name ?? "—"} icon={Package} detail={productsByQuantity[0] ? numberBR(productsByQuantity[0].quantity) + " un" : undefined} />
              <MetricCard label="Maior faturamento" value={productsByRevenue[0] ? formatCurrencyBRL(productsByRevenue[0].revenueCents) : "—"} icon={DollarSign} detail={productsByRevenue[0]?.name} />
              <MetricCard label="Maior lucro" value={productsByProfit[0] ? formatCurrencyBRL(productsByProfit[0].profitCents) : "—"} icon={TrendingUp} detail={productsByProfit[0]?.name} tone="success" />
              <MetricCard label="Maior margem" value={productsByMargin[0] ? pct(productsByMargin[0].marginPct) : "—"} icon={Percent} detail={productsByMargin[0]?.name} />
              <MetricCard label="Produtos vendidos" value={String(productsByQuantity.length)} icon={Boxes} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Quantidade vendida por produto" />
                <HorizontalBars
                  values={productsByQuantity.slice(0, 10).map((item) => ({
                    label: item.name,
                    value: item.quantity,
                    display: numberBR(item.quantity) + " un",
                  }))}
                />
              </Card>

              <Card>
                <SectionTitle title="Lucro por produto" />
                <HorizontalBars
                  values={productsByProfit.slice(0, 10).map((item) => ({
                    label: item.name,
                    value: Math.max(0, item.profitCents),
                    display: formatCurrencyBRL(item.profitCents),
                  }))}
                />
              </Card>
            </div>

            <Card>
              <SectionTitle title="Rentabilidade detalhada" description="A receita dos itens recebe rateio proporcional do desconto da venda para preservar a margem líquida por produto." />
              <DataTable
                headers={["Produto", "Qtd.", "Receita líquida", "Custo vendido", "Custo atual", "Lucro", "Margem", "Variação qtd."]}
                rows={productsByRevenue.map((item) => [
                  <span key={item.productId ?? item.name} className="font-medium text-ink">{item.name}</span>,
                  numberBR(item.quantity),
                  formatCurrencyBRL(item.revenueCents),
                  formatCurrencyBRL(item.costCents),
                  item.productId && currentProductCostById.has(item.productId)
                    ? formatCurrencyBRL(currentProductCostById.get(item.productId) ?? 0)
                    : "—",
                  formatCurrencyBRL(item.profitCents),
                  pct(item.marginPct),
                  <Delta key="delta" value={item.quantityChangePct} />,
                ])}
                empty="Nenhum produto vendido no período."
              />
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Maior margem" />
                <DataTable
                  headers={["Produto", "Margem", "Lucro", "Qtd."]}
                  rows={productsByMargin.slice(0, 10).map((item) => [
                    item.name,
                    pct(item.marginPct),
                    formatCurrencyBRL(item.profitCents),
                    numberBR(item.quantity),
                  ])}
                />
              </Card>
              <Card>
                <SectionTitle title="Produtos com menor margem" />
                <DataTable
                  headers={["Produto", "Margem", "Lucro", "Qtd."]}
                  rows={[...productsByMargin].reverse().slice(0, 10).map((item) => [
                    item.name,
                    pct(item.marginPct),
                    formatCurrencyBRL(item.profitCents),
                    numberBR(item.quantity),
                  ])}
                />
              </Card>
            </div>
          </div>
        )}

        {tab === "clientes" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Clientes com compras" value={String(customerMetrics.length)} icon={Users} />
              <MetricCard label="Novos clientes" value={String(customerBehavior.newCustomers)} icon={Users} />
              <MetricCard label="Recorrentes" value={String(customerBehavior.returningCustomers)} icon={Users} />
              <MetricCard label="Ticket médio" value={formatCurrencyBRL(summary.ticketMedioCents)} icon={DollarSign} />
              <MetricCard label="Inativos 30+ dias" value={String(inactiveCustomers.length)} icon={Clock3} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Receita concentrada nos maiores clientes" />
                <HorizontalBars
                  values={[
                    { label: "Top 5", value: concentration.top5Pct, display: pct(concentration.top5Pct) },
                    { label: "Top 10", value: concentration.top10Pct, display: pct(concentration.top10Pct) },
                    { label: "Top 20", value: concentration.top20Pct, display: pct(concentration.top20Pct) },
                  ]}
                />
              </Card>

              <Card>
                <SectionTitle title="Clientes inativos" description="Clientes ativos sem compra nos últimos 30 dias ou que nunca compraram." />
                <DataTable
                  headers={["Cliente", "Última compra", "Telefone"]}
                  rows={inactiveCustomers.slice(0, 15).map((customer) => [
                    customer.name,
                    customer.lastPurchase ? formatDateBR(customer.lastPurchase.toISOString()) : "Nunca comprou",
                    customer.phone,
                  ])}
                />
              </Card>
            </div>

            <Card>
              <SectionTitle title="Clientes por receita" description="Receita líquida das vendas do período." />
              <DataTable
                headers={["Cliente", "Pedidos", "Receita", "Ticket", "Itens", "Produto mais comprado", "Pendente", "Descontos", "Frequência"]}
                rows={customersByRevenue.map((customer) => [
                  <span key={customer.id} className="font-medium text-ink">{customer.name}</span>,
                  customer.purchaseCount,
                  formatCurrencyBRL(customer.totalCents),
                  formatCurrencyBRL(customer.averageTicketCents),
                  numberBR(customer.quantityItems),
                  customer.favoriteProductName ? customer.favoriteProductName + " (" + numberBR(customer.favoriteProductQuantity) + " un)" : "—",
                  formatCurrencyBRL(customer.pendingCents),
                  formatCurrencyBRL(customer.discountCents),
                  customer.frequencyDays !== null ? customer.frequencyDays + " dias" : "—",
                ])}
                empty="Nenhum cliente realizou compras no período."
              />
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Clientes mais frequentes" />
                <DataTable
                  headers={["Cliente", "Pedidos", "Receita"]}
                  rows={customersByPurchases.slice(0, 15).map((customer) => [
                    customer.name,
                    customer.purchaseCount,
                    formatCurrencyBRL(customer.totalCents),
                  ])}
                />
              </Card>
              <Card>
                <SectionTitle title="Maiores saldos pendentes" description="Saldo atual baseado no histórico de vendas." />
                <DataTable
                  headers={["Cliente", "Saldo pendente", "Vendas pendentes"]}
                  rows={pendingCustomers.slice(0, 15).map((customer) => [
                    customer.name,
                    formatCurrencyBRL(customer.totalCents),
                    customer.purchaseCount,
                  ])}
                  empty="Nenhum saldo pendente."
                />
              </Card>
            </div>
          </div>
        )}

        {tab === "financeiro" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="Receita bruta" value={formatCurrencyBRL(summary.faturamentoBrutoCents)} icon={DollarSign} />
              <MetricCard label="Descontos" value={formatCurrencyBRL(summary.discountCents)} icon={Percent} tone="warning" />
              <MetricCard label="Receita líquida" value={formatCurrencyBRL(summary.faturamentoLiquidoCents)} icon={ShoppingCart} />
              <MetricCard label="CMV" value={formatCurrencyBRL(summary.custoCents)} icon={Package} />
              <MetricCard label="Lucro bruto" value={formatCurrencyBRL(summary.lucroBrutoCents)} icon={TrendingUp} tone="success" />
              <MetricCard label="Lucro líquido" value={formatCurrencyBRL(lucroLiquidoCents)} icon={Wallet} tone={lucroLiquidoCents >= 0 ? "success" : "danger"} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Margem bruta" value={pct(summary.margemBrutaPct)} icon={Percent} />
              <MetricCard label="Margem líquida" value={pct(margemLiquidaPct)} icon={Percent} />
              <MetricCard label="A receber" value={formatCurrencyBRL(totalReceivableCents)} icon={Clock3} tone="warning" />
              <MetricCard label="Despesas" value={formatCurrencyBRL(expensesCents)} icon={Wallet} tone="danger" detail={<Delta value={previousExpensesCents > 0 ? ((expensesCents - previousExpensesCents) / previousExpensesCents) * 100 : null} />} />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Despesas por categoria" />
                <HorizontalBars
                  values={expenseCategories.slice(0, 10).map((expense) => ({
                    label: expense.category,
                    value: expense.amountCents,
                    display: formatCurrencyBRL(expense.amountCents),
                  }))}
                />
              </Card>

              <Card>
                <SectionTitle title="Contas a receber por idade" description="Idade calculada a partir da data da venda com saldo pendente." />
                <HorizontalBars
                  values={aging.map((bucket) => ({
                    label: bucket.label,
                    value: bucket.amountCents,
                    display: formatCurrencyBRL(bucket.amountCents),
                  }))}
                  empty="Nenhuma pendência."
                />
              </Card>
            </div>

            <Card>
              <SectionTitle title="Aging detalhado" />
              <DataTable
                headers={["Faixa", "Vendas pendentes", "Valor", "% do total pendente"]}
                rows={aging.map((bucket) => [
                  bucket.label,
                  bucket.quantitySales,
                  formatCurrencyBRL(bucket.amountCents),
                  pct(safeDividePct(bucket.amountCents, totalReceivableCents)),
                ])}
              />
            </Card>

            <Card>
              <SectionTitle title="Fluxo financeiro simplificado" description="Recebido das vendas selecionadas menos despesas registradas no período. Para fluxo de caixa contábil por data, seria necessário analisar as datas individuais de cada pagamento." />
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="Recebido" value={formatCurrencyBRL(summary.recebidoCents)} icon={Check} tone="success" />
                <MetricCard label="Despesas" value={formatCurrencyBRL(expensesCents)} icon={Wallet} tone="danger" />
                <MetricCard label="Saldo simplificado" value={formatCurrencyBRL(summary.recebidoCents - expensesCents)} icon={DollarSign} tone={summary.recebidoCents - expensesCents >= 0 ? "success" : "danger"} />
              </div>
            </Card>

            <Card>
              <SectionTitle title="Descontos concedidos" />
              <div className="grid gap-3 sm:grid-cols-3">
                <MetricCard label="Descontos no período" value={formatCurrencyBRL(summary.discountCents)} icon={Percent} tone="warning" />
                <MetricCard label="% sobre faturamento bruto" value={pct(summary.descontoPct)} icon={Percent} />
                <MetricCard label="Vendas com desconto" value={String(current.filter((sale) => sale.discountCents > 0).length)} icon={ShoppingCart} />
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                O desconto permanece separado do preço de tabela e é rateado proporcionalmente entre os itens apenas para análise de rentabilidade.
              </p>
            </Card>
          </div>
        )}

        {tab === "estoque" && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Valor total em estoque" value={formatCurrencyBRL(inventory.totalValueCents)} icon={Boxes} />
              <MetricCard label="Produtos em estoque" value={formatCurrencyBRL(inventory.productValueCents)} icon={Package} />
              <MetricCard label="Insumos em estoque" value={formatCurrencyBRL(inventory.insumoValueCents)} icon={Boxes} />
              <MetricCard label="Ingredientes em estoque" value={formatCurrencyBRL(inventory.ingredienteValueCents)} icon={Factory} />
              <MetricCard label="Sem estoque" value={String(inventory.noStockCount)} icon={TriangleAlert} tone="warning" />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionTitle title="Consumo estimado de insumos" description="Estimativa derivada das receitas e das unidades vendidas no período. Não altera o estoque real." />
                <DataTable
                  headers={["Insumo", "Unidade", "Quantidade estimada", "Custo estimado"]}
                  rows={consumption.slice(0, 20).map((item) => [
                    item.name,
                    item.unit,
                    numberBR(item.quantity),
                    formatCurrencyBRL(item.estimatedCostCents),
                  ])}
                  empty="Não foi possível estimar consumo com os dados atuais."
                />
              </Card>

              <Card>
                <SectionTitle title="Próximas encomendas em produção" description="Baseado em todas as encomendas ainda em produção." />
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Em produção" value={String(production.openOrders)} icon={Factory} />
                  <MetricCard label="Finalizadas" value={String(production.finalizedOrders)} icon={Check} />
                  <MetricCard label="Canceladas" value={String(production.canceledOrders)} icon={TriangleAlert} />
                  <MetricCard label="Pendente" value={formatCurrencyBRL(production.pendingValueCents)} icon={Clock3} tone="warning" />
                </div>
                <div className="mt-4">
                  {production.nextDueDate ? (
                    <div className="rounded-2xl bg-surface-muted p-4">
                      <p className="text-xs text-ink-muted">Próxima data de entrega</p>
                      <p className="mt-1 font-medium text-ink">
                        {new Date(production.nextDueDate + "T00:00:00").toLocaleDateString("pt-BR")}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {production.nextDueOrders} encomenda(s) prevista(s) para essa data.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted">Nenhuma encomenda em produção.</p>
                  )}
                </div>
              </Card>
            </div>

            <Card>
              <SectionTitle title="Estoque detalhado" description="Valor de produtos usa o custo atual das receitas; vendas históricas continuam usando o custo histórico armazenado." />
              <DataTable
                headers={["Tipo", "Item", "Unidade", "Quantidade", "Custo unit.", "Valor", "Status"]}
                rows={inventory.items
                  .filter((item) => item.active)
                  .sort((a, b) => b.stockValueCents - a.stockValueCents)
                  .map((item) => [
                    getKindLabel(item.kind),
                    item.name,
                    item.unit,
                    numberBR(item.quantity),
                    formatCurrencyBRL(item.unitCostCents),
                    formatCurrencyBRL(item.stockValueCents),
                    item.noStock ? (
                      <span key="status" className="font-medium text-warning-700">Sem estoque</span>
                    ) : (
                      <span key="status" className="text-success-700">Disponível</span>
                    ),
                  ])}
                  empty="Nenhum item ativo encontrado."
              />
            </Card>

            <Card>
              <SectionTitle title="Itens sem estoque" description="Não existe estoque mínimo configurado no modelo atual; portanto o alerta usa quantidade menor ou igual a zero." />
              <DataTable
                headers={["Tipo", "Item", "Unidade", "Quantidade", "Custo unit."]}
                rows={inventory.items
                  .filter((item) => item.active && item.noStock)
                  .map((item) => [
                    getKindLabel(item.kind),
                    item.name,
                    item.unit,
                    numberBR(item.quantity),
                    formatCurrencyBRL(item.unitCostCents),
                  ])}
                empty="Nenhum item ativo sem estoque."
              />
            </Card>
          </div>
        )}

        {tab === "abc" && (
          <div className="flex flex-col gap-4">
            <div className="no-print flex items-center justify-between rounded-2xl border border-line bg-surface p-3 shadow-card">
              <div>
                <p className="text-sm font-medium text-ink">Critério da Curva ABC</p>
                <p className="text-xs text-ink-muted">O acumulado usa dados apenas dos produtos com valor no critério selecionado.</p>
              </div>
              <Select value={abcMode} onChange={(event) => setAbcMode(event.target.value as typeof abcMode)} className="w-48">
                <option value="faturamento">Faturamento</option>
                <option value="lucro">Lucro</option>
                <option value="quantidade">Quantidade</option>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Classe A" value={String(abc.filter((item) => item.className === "A").length)} icon={BarChart3} />
              <MetricCard label="Classe B" value={String(abc.filter((item) => item.className === "B").length)} icon={BarChart3} />
              <MetricCard label="Classe C" value={String(abc.filter((item) => item.className === "C").length)} icon={BarChart3} />
            </div>

            <Card>
              <SectionTitle title="Participação acumulada" />
              <HorizontalBars
                values={abc.slice(0, 15).map((item) => ({
                  label: item.name,
                  value: item.accumulatedPct,
                  display: pct(item.accumulatedPct) + " · " + item.className,
                }))}
              />
            </Card>

            <Card>
              <SectionTitle title="Detalhamento ABC" />
              <DataTable
                headers={["Produto", "Qtd.", "Receita", "Lucro", "Participação", "Acumulado", "Classe"]}
                rows={abc.map((item) => [
                  item.name,
                  numberBR(item.quantity),
                  formatCurrencyBRL(item.revenueCents),
                  formatCurrencyBRL(item.profitCents),
                  pct(item.sharePct),
                  pct(item.accumulatedPct),
                  <span key="class" className="font-semibold text-ink">{item.className}</span>,
                ])}
                empty="Nenhum produto possui vendas suficientes para a curva ABC."
              />
            </Card>

            <Card>
              <SectionTitle title="Como ler este relatório" />
              <p className="text-sm leading-6 text-ink-muted">
                A classificação é puramente matemática: classe A cobre o acumulado até 80%, B até 95% e C o restante.
                A mesma tabela pode ser recalculada por faturamento, lucro ou quantidade.
              </p>
            </Card>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .shadow-card {
            box-shadow: none !important;
          }
        }
      `}</style>
    </AppShell>
  );

  function previousLucucroDiff(): number | null {
    if (previousSummary.lucroBrutoCents === 0 && previousExpensesCents === 0) return null;
    const denominator = Math.abs(previousLucroLiquidoCents);
    if (denominator === 0) return null;
    return ((lucroLiquidoCents - previousLucroLiquidoCents) / denominator) * 100;
  }
}
