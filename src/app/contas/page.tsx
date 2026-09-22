"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExpenseForm } from "@/features/expenses/components/ExpenseForm";
import { listAllExpenses, deleteExpense } from "@/lib/firebase/expenses";
import { getPeriodPreset, getCustomPeriod, PeriodKey } from "@/lib/firebase/reports";
import { Expense } from "@/types";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ContasPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [periodKey, setPeriodKey] = useState<PeriodKey>("mes");
  const [customStart, setCustomStart] = useState(todayIso());
  const [customEnd, setCustomEnd] = useState(todayIso());

  async function load() {
    setError(false);
    setExpenses(null);
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

  const filtered = expenses?.filter((e) => {
    const d = new Date(e.date + "T00:00:00");
    return d >= period.start && d < period.end;
  });

  const total = filtered?.reduce((sum, e) => sum + e.amountCents, 0) ?? 0;

  return (
    <AppShell title="Contas">
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
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-11 rounded-xl border border-line bg-surface px-3.5 text-sm"
              />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-11 rounded-xl border border-line bg-surface px-3.5 text-sm"
              />
            </>
          )}
        </div>
        <Button size="lg" className="w-full sm:w-auto" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
      </div>

      <Card className="mb-4">
        <p className="text-xs text-ink-muted">Total no período ({period.label})</p>
        <p className="font-display text-xl font-semibold text-danger-700">
          {formatCurrencyBRL(total)}
        </p>
      </Card>

      {expenses === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={Receipt}
          title="Não foi possível carregar as contas"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {filtered && filtered.length === 0 && !error && (
        <EmptyState
          icon={Receipt}
          title="Nenhuma conta nesse período"
          description="Registre gasolina, compra de insumos e outras despesas do negócio."
          actionLabel="+ Nova conta"
          onAction={() => setModalOpen(true)}
        />
      )}

      {filtered && filtered.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {filtered.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{expense.description}</p>
                  <p className="text-xs text-ink-muted">
                    {expense.category} · {formatDateBR(expense.date)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold text-danger-700">
                    {formatCurrencyBRL(expense.amountCents)}
                  </span>
                  <button
                    onClick={() => setDeletingId(expense.id)}
                    className="text-ink-faint hover:text-danger-500"
                    aria-label="Excluir conta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova conta">
        <ExpenseForm
          onSuccess={() => {
            setModalOpen(false);
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
          if (deletingId) {
            await deleteExpense(deletingId);
            load();
          }
        }}
      />
    </AppShell>
  );
}
