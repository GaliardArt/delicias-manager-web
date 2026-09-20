"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";
import { PaymentMethod } from "@/types";
import { addPayment } from "@/lib/firebase/sales";
import { paymentMethodOptions } from "@/lib/utils/payment-method";

interface AddPaymentFormProps {
  saleId: string;
  maxCents: number;
  onSuccess: () => void;
}

export function AddPaymentForm({ saleId, maxCents, onSuccess }: AddPaymentFormProps) {
  const [method, setMethod] = useState<PaymentMethod>("dinheiro");
  const [amountCents, setAmountCents] = useState(maxCents);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (amountCents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (amountCents > maxCents) {
      setError("O valor não pode ser maior que o pendente.");
      return;
    }
    setSubmitting(true);
    try {
      await addPayment(saleId, amountCents, method);
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível registrar o pagamento. Nenhum dado foi alterado."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label="Forma de pagamento"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        >
          {paymentMethodOptions
            .filter((opt) => opt.value !== "fiado")
            .map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
        </Select>
        <MoneyInput label="Valor" valueCents={amountCents} onValueCentsChange={setAmountCents} />
      </div>
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button onClick={handleSubmit} loading={submitting} className="w-full sm:w-auto">
        Registrar pagamento
      </Button>
    </div>
  );
}
