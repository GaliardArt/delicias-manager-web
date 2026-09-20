"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  AlertCircle,
  MessageCircle,
  Copy,
  TrendingUp,
  TrendingDown,
  Check,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { listActiveProducts } from "@/lib/firebase/products";
import { listActiveCustomers } from "@/lib/firebase/customers";
import {
  getAllSalesRaw,
  getPeriodPreset,
  getCustomPeriod,
  getPreviousPeriod,
  filterByPeriod,
  summarizeSales,
  summarizeProducts,
  summarizeTopCustomers,
  summarizePendingCustomers,
  findInactiveCustomers,
  computeTrends,
  buildWhatsAppSummary,
  RawSale,
  PeriodKey,
} from "@/lib/firebase/reports";
import { Product, Customer } from "@/types";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RelatoriosPage() {
  const [sales, setSales] = useState<RawSale[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState(false);

  const [periodKey, setPeriodKey] = useState<PeriodKey>("semana");
  const [customStart, setCustomStart] = useState(todayIso());
  const [customEnd, setCustomEnd] = useState(todayIso());
  const [copied, setCopied] = useState(false);

  async function load() {
    setError(false);
    setSales(null);
    try {
      const [s, p, c] = await Promise.all([
        getAllSalesRaw(),
        listActiveProducts(),
        listActiveCustomers(),
      ]);
      setSales(s);
      setProducts(p);
      setCustomers(c);
    } catch {
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

  const current = useMemo(() => (sales ? filterByPeriod(sales, period) : []), [sales, period]);
  const previous = useMemo(
    () => (sales ? filterByPeriod(sales, getPreviousPeriod(period)) : []),
    [sales, period]
  );

  const salesSummary = useMemo(() => summarizeSales(current), [current]);
  const productsSummary = useMemo(
    () => summarizeProducts(current, products),
    [current, products]
  );
  const topCustomers = useMemo(() => summarizeTopCustomers(current), [current]);
  const pendingCustomers = useMemo(
    () => (sales ? summarizePendingCustomers(sales) : []),
    [sales]
  );
  const inactiveCustomers = useMemo(
    () => (sales ? findInactiveCustomers(sales, customers) : []),
    [sales, customers]
  );
  const trends = useMemo(() => computeTrends(current, previous), [current, previous]);

  const whatsappText = useMemo(
    () => buildWhatsAppSummary(period, salesSummary, productsSummary.topSelling),
    [period, salesSummary, productsSummary]
  );

  function handleShareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, "_blank");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard indisponível (ex: contexto não seguro) — sem problema, o
      // botão de WhatsApp continua funcionando normalmente.
    }
  }

  if (sales === null && !error) {
    return (
      <AppShell title="Relatórios">
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select
            label="Período"
            value={periodKey}
            onChange={(e) => setPeriodKey(e.target.value as PeriodKey)}
            className="sm:w-48"
          >
            <option value="hoje">Hoje</option>
            <option value="semana">Últimos 7 dias</option>
            <option value="mes">Últimos 30 dias</option>
            <option value="personalizado">Personalizado</option>
          </Select>
          {periodKey === "personalizado" && (
            <>
              <Input
                label="De"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <Input
                label="Até"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button onClick={handleShareWhatsApp}>
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
        </div>
      </div>

      {current.length === 0 && previous.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Sem vendas neste período"
          description="Registre vendas para começar a ver os relatórios preenchidos."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendas — {period.label}</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div>
                <p className="text-xs text-ink-muted">Faturamento</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(salesSummary.faturamentoCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Recebido</p>
                <p className="font-display text-base font-semibold text-success-700">
                  {formatCurrencyBRL(salesSummary.recebidoCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Pendente</p>
                <p className="font-display text-base font-semibold text-warning-700">
                  {formatCurrencyBRL(salesSummary.pendenteCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Vendas</p>
                <p className="font-display text-base font-semibold text-ink">
                  {salesSummary.quantidadeVendas}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Ticket médio</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(salesSummary.ticketMedioCents)}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Produtos mais vendidos</CardTitle>
              </CardHeader>
              {productsSummary.topSelling.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum produto vendido neste período.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {productsSummary.topSelling.map((p, i) => (
                    <li key={p.name} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-ink">
                        {i + 1}. {p.name}
                      </span>
                      <span className="font-medium text-ink-muted">
                        {p.quantity} un · {formatCurrencyBRL(p.revenueCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Produtos menos vendidos</CardTitle>
              </CardHeader>
              {productsSummary.leastSelling.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum produto ativo cadastrado.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {productsSummary.leastSelling.map((p) => (
                    <li key={p.name} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-ink">{p.name}</span>
                      <span className="font-medium text-ink-muted">{p.quantity} un</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Clientes que mais compraram</CardTitle>
              </CardHeader>
              {topCustomers.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhuma compra neste período.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {topCustomers.map((c, i) => (
                    <li key={c.name + i} className="flex items-center justify-between py-2 text-sm">
                      <span className="truncate text-ink">{c.name}</span>
                      <span className="shrink-0 font-medium text-ink-muted">
                        {formatCurrencyBRL(c.totalCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Valores pendentes</CardTitle>
              </CardHeader>
              {pendingCustomers.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum valor pendente. 🎉</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {pendingCustomers.slice(0, 5).map((c, i) => (
                    <li key={c.name + i} className="flex items-center justify-between py-2 text-sm">
                      <span className="truncate text-ink">{c.name}</span>
                      <span className="shrink-0 font-medium text-warning-700">
                        {formatCurrencyBRL(c.totalCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sem compras recentes</CardTitle>
              </CardHeader>
              {inactiveCustomers.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Todos os clientes ativos compraram nos últimos 30 dias.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {inactiveCustomers.slice(0, 5).map((c) => (
                    <li key={c.name} className="flex items-center justify-between py-2 text-sm">
                      <span className="truncate text-ink">{c.name}</span>
                      <span className="shrink-0 text-xs text-ink-muted">
                        {c.lastPurchaseAt ? formatDateBR(c.lastPurchaseAt) : "Nunca comprou"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tendências</CardTitle>
            </CardHeader>
            {!trends.hasEnoughData ? (
              <p className="text-sm text-ink-muted">Dados insuficientes para gerar esta análise.</p>
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-2">
                  {trends.revenueChangePct === null ? (
                    <span className="text-ink-muted">
                      Faturamento sem período anterior para comparar.
                    </span>
                  ) : (
                    <>
                      {trends.revenueChangePct >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-success-700" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-danger-500" />
                      )}
                      <span className="text-ink">
                        Faturamento {trends.revenueChangePct >= 0 ? "cresceu" : "caiu"}{" "}
                        <span className="font-semibold">
                          {Math.abs(trends.revenueChangePct).toFixed(0)}%
                        </span>{" "}
                        em relação ao período anterior
                      </span>
                    </>
                  )}
                </div>

                {trends.busiestWeekday && (
                  <p className="text-ink-muted">
                    Dia de maior movimento no período:{" "}
                    <span className="font-medium text-ink">{trends.busiestWeekday}</span>
                  </p>
                )}

                {trends.growingProducts.length > 0 && (
                  <p className="text-ink-muted">
                    Em alta:{" "}
                    <span className="font-medium text-ink">
                      {trends.growingProducts.map((p) => p.name).join(", ")}
                    </span>
                  </p>
                )}
                {trends.decliningProducts.length > 0 && (
                  <p className="text-ink-muted">
                    Em queda:{" "}
                    <span className="font-medium text-ink">
                      {trends.decliningProducts.map((p) => p.name).join(", ")}
                    </span>
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
