"use client";

import { InputHTMLAttributes, forwardRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  label?: string;
  error?: string;
  /** Valor atual em centavos (fonte da verdade — nunca usar float para dinheiro). */
  valueCents: number;
  onValueCentsChange: (cents: number) => void;
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Máscara estilo "caixa eletrônico": cada dígito digitado empurra os centavos,
// nunca deixa o usuário digitar vírgula/ponto manualmente — elimina erros de
// ponto flutuante e de formatação (seção 33 da spec).
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, label, error, id, valueCents, onValueCentsChange, ...props }, ref) => {
    const [display, setDisplay] = useState(centsToDisplay(valueCents));

    useEffect(() => {
      setDisplay(centsToDisplay(valueCents));
    }, [valueCents]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const digitsOnly = e.target.value.replace(/\D/g, "");
      const cents = digitsOnly ? parseInt(digitsOnly, 10) : 0;
      onValueCentsChange(cents);
      setDisplay(centsToDisplay(cents));
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
            R$
          </span>
          <input
            ref={ref}
            id={id}
            inputMode="numeric"
            value={display}
            onChange={handleChange}
            className={cn(
              "h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3.5 text-right text-sm text-ink outline-none transition-colors",
              "focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
              error && "border-danger-500 focus:border-danger-500 focus:ring-danger-50",
              className
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-danger-500">{error}</span>}
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";
