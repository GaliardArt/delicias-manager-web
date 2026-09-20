"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createSalesDay } from "@/lib/firebase/sales-days";

interface CreateSalesDayFormProps {
  onSuccess: (id: string) => void;
}

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CreateSalesDayForm({ onSuccess }: CreateSalesDayFormProps) {
  const [date, setDate] = useState(todayPlusDays(1));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const id = await createSalesDay(date);
      onSuccess(id);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível criar o Dia de Venda. Nenhum dado foi alterado."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <p className="text-xs text-ink-muted">
        Encomendas já cadastradas com essa data de entrega prevista são vinculadas
        automaticamente.
      </p>
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="mt-1 w-full">
        Criar Dia de Venda
      </Button>
    </form>
  );
}
