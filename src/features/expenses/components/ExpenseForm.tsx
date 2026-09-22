"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";
import { createExpense } from "@/lib/firebase/expenses";
import { todayLocalIso } from "@/lib/utils/format";

interface ExpenseFormProps {
  onSuccess: () => void;
}

export function ExpenseForm({ onSuccess }: ExpenseFormProps) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [date, setDate] = useState(todayLocalIso());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setSubmitting(true);
    try {
      await createExpense({
        description: description.trim(),
        category: category.trim() || "Geral",
        amountCents,
        date,
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar a conta. Nenhum dado foi alterado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Descrição"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Gasolina, compra de embalagens..."
        autoFocus
      />
      <Input
        label="Categoria (opcional)"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Transporte, Insumos, Aluguel..."
      />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label="Valor" valueCents={amountCents} onValueCentsChange={setAmountCents} />
        <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="mt-1 w-full">
        Registrar conta
      </Button>
    </form>
  );
}
