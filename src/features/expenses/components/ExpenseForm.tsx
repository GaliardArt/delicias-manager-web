"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  createExpense,
  updateExpense,
  EXPENSE_CATEGORIES,
} from "@/lib/firebase/expenses";
import { todayLocalIso } from "@/lib/utils/format";
import type { Expense, ExpenseKind, ExpenseRecurrence, ExpenseStatus } from "@/types";

interface ExpenseFormProps {
  onSuccess: () => void;
  expense?: Expense | null;
}

export function ExpenseForm({ onSuccess, expense }: ExpenseFormProps) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Outros");
  const [amountCents, setAmountCents] = useState(0);
  const [date, setDate] = useState(todayLocalIso());
  const [dueDate, setDueDate] = useState(todayLocalIso());
  const [paidAt, setPaidAt] = useState(todayLocalIso());
  const [kind, setKind] = useState<ExpenseKind>("variavel");
  const [status, setStatus] = useState<ExpenseStatus>("pago");
  const [recurrence, setRecurrence] = useState<ExpenseRecurrence>("nenhuma");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expense) {
      setDescription("");
      setCategory("Outros");
      setAmountCents(0);
      setDate(todayLocalIso());
      setDueDate(todayLocalIso());
      setPaidAt(todayLocalIso());
      setKind("variavel");
      setStatus("pago");
      setRecurrence("nenhuma");
      setNotes("");
      setError(null);
      return;
    }

    const fallbackDate = expense.date || todayLocalIso();
    setDescription(expense.description);
    setCategory(expense.category || "Outros");
    setAmountCents(expense.amountCents);
    setDate(fallbackDate);
    setDueDate(expense.dueDate || fallbackDate);
    setPaidAt(expense.paidAt || fallbackDate);
    setKind(expense.kind ?? "variavel");
    setStatus(expense.status ?? "pago");
    setRecurrence(expense.recurrence ?? "nenhuma");
    setNotes(expense.notes ?? "");
    setError(null);
  }, [expense]);

  function handleStatusChange(nextStatus: ExpenseStatus) {
    setStatus(nextStatus);
    if (nextStatus === "pago" && !paidAt) {
      setPaidAt(todayLocalIso());
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError("Informe a descrição da conta.");
      return;
    }
    if (amountCents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (!date) {
      setError("Informe a data da despesa.");
      return;
    }
    if (dueDate && dueDate < date) {
      setError("O vencimento não pode ser anterior à data da despesa.");
      return;
    }
    if (status === "pago" && !paidAt) {
      setError("Informe a data do pagamento.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        description: description.trim(),
        category,
        amountCents,
        date,
        dueDate: dueDate || date,
        paidAt: status === "pago" ? paidAt || date : undefined,
        kind,
        status,
        recurrence,
        notes,
      };

      if (expense) {
        await updateExpense(expense.id, payload);
      } else {
        await createExpense(payload);
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setError(
        expense
          ? "Não foi possível atualizar a conta. Nenhum dado foi alterado."
          : "Não foi possível salvar a conta. Nenhum dado foi alterado."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[75vh] flex-col gap-3 overflow-y-auto pr-1">
      <Input
        label="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Gasolina, compra de embalagens..."
        autoFocus
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {EXPENSE_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        <Select
          label="Tipo"
          value={kind}
          onChange={(e) => setKind(e.target.value as ExpenseKind)}
        >
          <option value="variavel">Variável</option>
          <option value="fixa">Fixa</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MoneyInput
          label="Valor"
          valueCents={amountCents}
          onValueCentsChange={setAmountCents}
        />
        <Input
          label="Data da despesa"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Status"
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as ExpenseStatus)}
        >
          <option value="pago">Pago</option>
          <option value="pendente">Pendente</option>
        </Select>
        <Input
          label="Vencimento"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      {status === "pago" && (
        <Input
          label="Data do pagamento"
          type="date"
          value={paidAt}
          onChange={(e) => setPaidAt(e.target.value)}
        />
      )}

      <Select
        label="Recorrência"
        value={recurrence}
        onChange={(e) => setRecurrence(e.target.value as ExpenseRecurrence)}
      >
        <option value="nenhuma">Não se repete</option>
        <option value="semanal">Semanal</option>
        <option value="mensal">Mensal</option>
        <option value="anual">Anual</option>
      </Select>

      <div>
        <label
          htmlFor="expense-notes"
          className="mb-1.5 block text-xs font-medium text-ink-muted"
        >
          Observações
        </label>
        <textarea
          id="expense-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: pago no cartão, referente à compra do estoque..."
          rows={3}
          className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <Button type="submit" loading={submitting} className="mt-1 w-full">
        {expense ? "Salvar alterações" : "Registrar conta"}
      </Button>
    </form>
  );
}
