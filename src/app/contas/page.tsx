"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  Pencil,
  Plus,
  Receipt,
  Search,
  Tags,
  Trash2,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";
import {
  deleteExpense,
  isExpenseOverdue,
  listAllExpenses,
  updateExpense,
} from "@/lib/firebase/expenses";
import { getPeriodPreset, getCustomPeriod, PeriodKey } from "@/lib/firebase/reports";
import { Expense, ExpenseKind, ExpenseStatus } from "@/types";
import { formatCurrencyBRL, formatDateBR, todayLocalIso } from "@/lib/utils/format";

type StatusFilter = "todos" | ExpenseStatus | "vencido";
type KindFilter = "todos" | ExpenseKind;

const statusLabel: Record<ExpenseStatus, string> = {
  pago: "Pago",
  pendente: "Pendente",
};

const kindLabel: Record<ExpenseKind, string> = {
  fixa: "Fixa",
  variavel: "Variável",
};

function addDays(dateIso: string, days: number): string {
  const date = new Date(dateIso + "T00:00:00");
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function variationPct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  icon: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const valueClass =
    tone === "success"
      ? "text-success-700"
      : tone === "warning"
        ? "text-warning-700"
        : tone === "danger"
          ? "text-danger-700"
          : "text-ink";

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-muted">{label}</p>
          <p className={"mt-1 truncate font-display text-xl font-semibold " + valueClass}>
            {value}
          </p>
          {detail && <p className="mt-1 text-xs text-ink-faint">{detail}</p>}
        </div>
        <div className="rounded-xl bg-surface-muted p-2 text-ink-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function statusTone(
  expense: Expense,
  today: string
): "success" | "warning" | "danger" {
  if (isExpenseOverdue(expense, today)) return "danger";
  return expense.status === "pago" ? "success" : "warning";
}

export default function ContasPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [periodKey, setPeriodKey] = useState<PeriodKey>("mes");
  const [customStart, setCustomStart] = useState(todayLocalIso());
  const [customEnd, setCustomEnd] = useState(todayLocalIso());

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [kindFilter, setKindFilter] = useState<KindFilter>("todos");

  async function load(showSkeleton = true) {
    setError(false);
    if (showSkeleton) setExpenses(null);
    try {
      setExpenses(await listAllExpenses());
    } catch (err) {
      console.error(err);
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

  const previousPeriod = useMemo(
    () => ({
      start: new Date(
        period.start.getTime() - (period.end.getTime() - period.start.getTime())
      ),
      end: period.start,
    }),
    [period]
  );

  const periodExpenses = useMemo(
    () =>
      expenses?.filter((expense) => {
        const date = new Date(expense.date + "T00:00:00");
        return date >= period.start && date < period.end;
      }) ?? [],
    [expenses, period]
  );

  const previousPeriodExpenses = useMemo(
    () =>
      expenses?.filter((expense) => {
        const date = new Date(expense.date + "T00:00:00");
        return date >= previousPeriod.start && date < previousPeriod.end;
      }) ?? [],
    [expenses, previousPeriod]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set((expenses ?? []).map((expense) => expense.category).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [expenses]
  );

  const total = useMemo(
    () => periodExpenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    [periodExpenses]
  );

  const previousTotal = useMemo(
    () => previousPeriodExpenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    [previousPeriodExpenses]
  );

  const pendingTotal = useMemo(
    () =>
      periodExpenses
        .filter((expense) => expense.status === "pendente")
        .reduce((sum, expense) => sum + expense.amountCents, 0),
    [periodExpenses]
  );

  const overdueTotal = useMemo(
    () =>
      periodExpenses
        .filter((expense) => isExpenseOverdue(expense, todayLocalIso()))
        .reduce((sum, expense) => sum + expense.amountCents, 0),
    [periodExpenses]
  );

  const fixedTotal = useMemo(
    () =>
      periodExpenses
        .filter((expense) => expense.kind === "fixa")
        .reduce((sum, expense) => sum + expense.amountCents, 0),
    [periodExpenses]
  );

  const variableTotal = useMemo(
    () =>
      periodExpenses
        .filter((expense) => expense.kind !== "fixa")
        .reduce((sum, expense) => sum + expense.amountCents, 0),
    [periodExpenses]
  );

  const largestExpense = useMemo(
    () =>
      periodExpenses.reduce<Expense | null>(
        (largest, expense) =>
          !largest || expense.amountCents > largest.amountCents ? expense : largest,
        null
      ),
    [periodExpenses]
  );

  const periodDays = Math.max(
    1,
    Math.ceil((period.end.getTime() - period.start.getTime()) / 86400000)
  );
  const dailyAverage = total > 0 ? Math.round(total / periodDays) : 0;
  const variation = variationPct(total, previousTotal);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    const today = todayLocalIso();

    return [...periodExpenses]
      .filter((expense) => {
        const haystack = [
          expense.description,
          expense.category,
          expense.notes ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase("pt-BR");

        const matchesSearch =
          !normalizedSearch || haystack.includes(normalizedSearch);
        const matchesCategory =
          categoryFilter === "todas" || expense.category === categoryFilter;

        const overdue = isExpenseOverdue(expense, today);
        const matchesStatus =
          statusFilter === "todos" ||
          (statusFilter === "vencido"
            ? overdue
            : expense.status === statusFilter);

        const matchesKind =
          kindFilter === "todos" || (expense.kind ?? "variavel") === kindFilter;

        return matchesSearch && matchesCategory && matchesStatus && matchesKind;
      })
      .sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.amountCents - a.amountCents;
      });
  }, [periodExpenses, search, categoryFilter, statusFilter, kindFilter]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();

    for (const expense of periodExpenses) {
      map.set(
        expense.category,
        (map.get(expense.category) ?? 0) + expense.amountCents
      );
    }

    return Array.from(map.entries())
      .map(([category, amountCents]) => ({
        category,
        amountCents,
        sharePct: total > 0 ? (amountCents / total) * 100 : 0,
      }))
      .sort((a, b) => b.amountCents - a.amountCents);
  }, [periodExpenses, total]);

  const upcomingAll = useMemo(() => {
    const today = todayLocalIso();
    const limit = addDays(today, 30);

    return (expenses ?? [])
      .filter(
        (expense) =>
          expense.status === "pendente" &&
          Boolean(expense.dueDate) &&
          expense.dueDate! >= today &&
          expense.dueDate! <= limit
      )
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  }, [expenses]);

  const upcoming = upcomingAll.slice(0, 6);

  const globalOverdue = useMemo(
    () =>
      (expenses ?? []).filter((expense) =>
        isExpenseOverdue(expense, todayLocalIso())
      ),
    [expenses]
  );

  const globalOverdueTotal = useMemo(
    () => globalOverdue.reduce((sum, expense) => sum + expense.amountCents, 0),
    [globalOverdue]
  );

  function openCreateModal() {
    setSelectedExpense(null);
    setModalOpen(true);
  }

  function openEditModal(expense: Expense) {
    setSelectedExpense(expense);
    setModalOpen(true);
  }

  async function markAsPaid(expense: Expense) {
    try {
      await updateExpense(expense.id, {
        description: expense.description,
        category: expense.category,
        amountCents: expense.amountCents,
        date: expense.date,
        dueDate: expense.dueDate,
        paidAt: todayLocalIso(),
        kind: expense.kind ?? "variavel",
        status: "pago",
        recurrence: expense.recurrence ?? "nenhuma",
        notes: expense.notes,
      });
      await load(false);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  return (
    <AppShell title="Contas">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-ink-muted">
            Controle de despesas, contas a pagar e impacto dos gastos no negócio.
          </p>
        </div>

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
          <Button size="lg" className="w-full sm:w-auto" onClick={openCreateModal}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        </div>
      </div>

      {periodKey === "personalizado" && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="date"
            aria-label="Início do período"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-11 rounded-xl border border-line bg-surface px-3.5 text-sm"
          />
          <input
            type="date"
            aria-label="Fim do período"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="h-11 rounded-xl border border-line bg-surface px-3.5 text-sm"
          />
        </div>
      )}

      {expenses === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={Receipt}
          title="Não foi possível carregar as contas"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={() => load()}
        />
      )}

      {expenses !== null && !error && (
        <>
          {(globalOverdue.length > 0 || upcomingAll.length > 0) && (
            <Card className="mb-5 border-warning-200 bg-warning-50">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-warning-100 p-2 text-warning-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-warning-800">Atenção financeira</p>
                  <p className="mt-1 text-sm text-warning-700">
                    {globalOverdue.length > 0
                      ? globalOverdue.length +
                        (globalOverdue.length === 1 ? " conta vencida" : " contas vencidas") +
                        " (" +
                        formatCurrencyBRL(globalOverdueTotal) +
                        ")"
                      : ""}
                    {globalOverdue.length > 0 && upcomingAll.length > 0 ? " · " : ""}
                    {upcomingAll.length > 0
                      ? upcomingAll.length +
                        (upcomingAll.length === 1
                          ? " conta vence nos próximos 30 dias"
                          : " contas vencem nos próximos 30 dias")
                      : ""}
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric
              label="Total gasto"
              value={formatCurrencyBRL(total)}
              detail={
                variation === null
                  ? "sem comparação"
                  : (variation >= 0 ? "+" : "") +
                    variation.toFixed(1) +
                    "% vs. período anterior"
              }
              icon={TrendingDown}
              tone="danger"
            />
            <Metric
              label="Em aberto"
              value={formatCurrencyBRL(pendingTotal)}
              detail={
                overdueTotal > 0
                  ? formatCurrencyBRL(overdueTotal) + " vencido"
                  : "Nenhum vencido no período"
              }
              icon={Clock3}
              tone="warning"
            />
            <Metric
              label="Média por dia"
              value={formatCurrencyBRL(dailyAverage)}
              detail={periodDays + (periodDays === 1 ? " dia" : " dias") + " no período"}
              icon={BarChart3}
            />
            <Metric
              label="Maior gasto"
              value={formatCurrencyBRL(largestExpense?.amountCents ?? 0)}
              detail={largestExpense?.description ?? "Nenhum gasto"}
              icon={Receipt}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Gastos por categoria</CardTitle>
                  <p className="mt-1 text-xs text-ink-muted">
                    Onde o dinheiro está sendo consumido em {period.label.toLowerCase()}.
                  </p>
                </div>
                <Tags className="h-4 w-4 text-ink-faint" />
              </CardHeader>

              {categoryBreakdown.length === 0 ? (
                <p className="text-sm text-ink-muted">Nenhum gasto no período.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {categoryBreakdown.slice(0, 8).map((item) => {
                    const width = total > 0 ? (item.amountCents / total) * 100 : 0;

                    return (
                      <div key={item.category}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-medium text-ink">{item.category}</span>
                          <span className="shrink-0 text-ink-muted">
                            {formatCurrencyBRL(item.amountCents)} · {item.sharePct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full bg-brand-400 transition-all"
                            style={{ width: width + "%" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Fixo x variável</CardTitle>
                  <p className="mt-1 text-xs text-ink-muted">
                    Composição das despesas do período.
                  </p>
                </div>
                <CalendarClock className="h-4 w-4 text-ink-faint" />
              </CardHeader>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-surface-muted p-3">
                  <p className="text-xs text-ink-muted">Fixas</p>
                  <p className="mt-1 font-display text-lg font-semibold text-ink">
                    {formatCurrencyBRL(fixedTotal)}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {total > 0 ? ((fixedTotal / total) * 100).toFixed(1) : "0,0"}%
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-muted p-3">
                  <p className="text-xs text-ink-muted">Variáveis</p>
                  <p className="mt-1 font-display text-lg font-semibold text-ink">
                    {formatCurrencyBRL(variableTotal)}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {total > 0 ? ((variableTotal / total) * 100).toFixed(1) : "0,0"}%
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {upcoming.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <div>
                  <CardTitle>Próximos vencimentos</CardTitle>
                  <p className="mt-1 text-xs text-ink-muted">
                    Contas pendentes para os próximos 30 dias.
                  </p>
                </div>
                <Clock3 className="h-4 w-4 text-ink-faint" />
              </CardHeader>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((expense) => (
                  <button
                    key={expense.id}
                    type="button"
                    onClick={() => openEditModal(expense)}
                    className="rounded-2xl border border-line bg-surface p-3 text-left transition hover:bg-surface-muted"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-ink">{expense.description}</p>
                      <span className="shrink-0 text-sm font-semibold text-warning-700">
                        {formatCurrencyBRL(expense.amountCents)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-muted">
                      Vence em {formatDateBR(expense.dueDate ?? expense.date)}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card className={"mt-4 " + (periodExpenses.length === 0 ? "hidden" : "")}>
            <CardHeader>
              <div>
                <CardTitle>Lançamentos</CardTitle>
                <p className="mt-1 text-xs text-ink-muted">
                  {filtered.length}{" "}
                  {filtered.length === 1
                    ? "lançamento encontrado"
                    : "lançamentos encontrados"}
                  .
                </p>
              </div>
              <Filter className="h-4 w-4 text-ink-faint" />
            </CardHeader>

            <div className="mb-4 grid gap-3 md:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por descrição, categoria..."
                  className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3.5 text-sm outline-none transition placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <Select
                aria-label="Filtrar categoria"
                label="Categoria"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="todas">Todas</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>

              <Select
                aria-label="Filtrar status"
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="todos">Todos</option>
                <option value="pago">Pagos</option>
                <option value="pendente">Pendentes</option>
                <option value="vencido">Vencidos</option>
              </Select>

              <Select
                aria-label="Filtrar tipo"
                label="Tipo"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as KindFilter)}
              >
                <option value="todos">Todos</option>
                <option value="fixa">Fixas</option>
                <option value="variavel">Variáveis</option>
              </Select>
            </div>

            {filtered.length === 0 && periodExpenses.length > 0 ? (
              <p className="rounded-2xl bg-surface-muted px-4 py-8 text-center text-sm text-ink-muted">
                Nenhum lançamento corresponde aos filtros atuais.
              </p>
            ) : filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[1.6fr_1fr_.8fr_.8fr_auto] gap-3 border-b border-line px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                    <span>Despesa</span>
                    <span>Categoria</span>
                    <span>Data</span>
                    <span>Status</span>
                    <span className="text-right">Valor</span>
                  </div>

                  <ul className="divide-y divide-line">
                    {filtered.map((expense) => {
                      const today = todayLocalIso();
                      const overdue = isExpenseOverdue(expense, today);

                      return (
                        <li
                          key={expense.id}
                          className="grid grid-cols-[1.6fr_1fr_.8fr_.8fr_auto] items-center gap-3 px-2 py-3.5"
                        >
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openEditModal(expense)}
                              className="block max-w-full truncate text-left text-sm font-medium text-ink hover:text-brand-700"
                            >
                              {expense.description}
                            </button>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs text-ink-faint">
                                {kindLabel[expense.kind ?? "variavel"]}
                              </span>
                              {expense.recurrence && expense.recurrence !== "nenhuma" && (
                                <span className="text-xs text-ink-faint">
                                  · {expense.recurrence}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className="truncate text-xs text-ink-muted">
                            {expense.category}
                          </span>

                          <div className="text-xs text-ink-muted">
                            <p>{formatDateBR(expense.date)}</p>
                            <p className="mt-0.5 text-[11px] text-ink-faint">
                              vence {formatDateBR(expense.dueDate ?? expense.date)}
                            </p>
                          </div>

                          <Badge tone={statusTone(expense, today)}>
                            {overdue ? "Vencido" : statusLabel[expense.status ?? "pago"]}
                          </Badge>

                          <div className="flex items-center justify-end gap-1.5">
                            <span className="whitespace-nowrap text-sm font-semibold text-danger-700">
                              {formatCurrencyBRL(expense.amountCents)}
                            </span>

                            {expense.status === "pendente" && (
                              <button
                                type="button"
                                onClick={() => markAsPaid(expense)}
                                className="rounded-lg p-1.5 text-success-700 hover:bg-success-50"
                                aria-label="Marcar como pago"
                                title="Marcar como pago"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditModal(expense)}
                              className="rounded-lg p-1.5 text-ink-faint hover:bg-surface-muted hover:text-ink"
                              aria-label="Editar conta"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingId(expense.id)}
                              className="rounded-lg p-1.5 text-ink-faint hover:bg-danger-50 hover:text-danger-500"
                              aria-label="Excluir conta"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </Card>

        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedExpense(null);
        }}
        title={selectedExpense ? "Editar conta" : "Nova conta"}
      >
        <ExpenseForm
          expense={selectedExpense}
          onSuccess={() => {
            setModalOpen(false);
            setSelectedExpense(null);
            load();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={deletingId !== null}
        onClose={() => setDeletingId(null)}
        title="Excluir conta"
        description="Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        danger
        onConfirm={async () => {
          if (!deletingId) return;

          try {
            await deleteExpense(deletingId);
            setDeletingId(null);
            await load(false);
          } catch (err) {
            console.error(err);
            setError(true);
          }
        }}
      />
    </AppShell>
  );
}
