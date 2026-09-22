"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Modal } from "./Modal";
import { Input } from "./Input";
import { Button } from "./Button";

interface StockAdjustDialogProps {
  open: boolean;
  onClose: () => void;
  currentStock: number;
  unit: string;
  onConfirm: (delta: number) => Promise<void>;
}

export function StockAdjustDialog({
  open,
  onClose,
  currentStock,
  unit,
  onConfirm,
}: StockAdjustDialogProps) {
  const [delta, setDelta] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (delta === 0) {
      setError("Informe uma quantidade diferente de zero.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(delta);
      setDelta(0);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Não foi possível ajustar o estoque. Nenhum dado foi alterado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Ajustar estoque" maxWidthClassName="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">
          Estoque atual: <span className="font-semibold text-ink">{currentStock} {unit}</span>
        </p>
        <Input
          label={`Quantidade a somar (use negativo para tirar), em ${unit}`}
          type="number"
          step="any"
          value={delta}
          onChange={(e) => setDelta(Number(e.target.value))}
          autoFocus
        />
        {error && (
          <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        <Button type="submit" loading={submitting} className="w-full">
          Confirmar ajuste
        </Button>
      </form>
    </Modal>
  );
}
