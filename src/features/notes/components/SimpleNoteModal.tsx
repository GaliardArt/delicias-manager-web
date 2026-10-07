"use client";

import { Printer } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatCurrencyBRL } from "@/lib/utils/format";
import type { SimpleNoteData } from "@/lib/utils/simple-note";

interface SimpleNoteModalProps {
  open: boolean;
  onClose: () => void;
  data: SimpleNoteData;
}

export function SimpleNoteModal({ open, onClose, data }: SimpleNoteModalProps) {
  const [generating, setGenerating] = useState(false);

  async function handlePrintNote() {
    setGenerating(true);
    try {
      window.print();
    } finally {
      setGenerating(false);
    }
  }

  const notePaper = (
    <div className="simple-note-paper rounded-xl border border-line bg-white p-5 shadow-card">
      <div className="border-b border-dashed border-line pb-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
          Joci Molina - Delicias Artesanais
        </p>
        <h3 className="mt-1 font-display text-xl font-bold text-ink">Nota simples</h3>
        <p className="mt-1 text-xs text-ink-muted">{data.kindLabel}</p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1 text-sm">
        <p><span className="text-ink-muted">Cliente:</span> <strong>{data.customerName}</strong></p>
        <p><span className="text-ink-muted">Data:</span> {data.dateLabel}</p>
        {data.deliveryDateLabel && <p><span className="text-ink-muted">Entrega prevista:</span> {data.deliveryDateLabel}</p>}
        {data.deliveryAddress && <p><span className="text-ink-muted">Endereço:</span> {data.deliveryAddress}</p>}
      </div>

      <div className="my-4 border-t border-dashed border-line pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Compras</p>
        <div className="flex flex-col divide-y divide-line">
          {data.items.map((item, index) => (
            <div key={index} className="flex items-start justify-between gap-3 py-2">
              <div>
                <p className="text-sm font-medium text-ink">{item.quantity} × {item.name}</p>
                <p className="text-xs text-ink-muted">{formatCurrencyBRL(item.unitPriceCents)} cada</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-ink">{formatCurrencyBRL(item.totalCents)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-line pt-3 text-sm">
        <div className="flex justify-between"><span className="text-ink-muted">Subtotal</span><span>{formatCurrencyBRL(data.subtotalCents)}</span></div>
        {data.discountCents > 0 && <div className="mt-1 flex justify-between"><span className="text-ink-muted">Desconto</span><span className="font-semibold text-danger-700">- {formatCurrencyBRL(data.discountCents)}</span></div>}
        <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold"><span>Total</span><span>{formatCurrencyBRL(data.totalCents)}</span></div>
        <div className="mt-2 flex justify-between"><span className="text-ink-muted">Recebido</span><span className="text-success-700">{formatCurrencyBRL(data.paidCents)}</span></div>
        <div className="mt-1 flex justify-between"><span className="text-ink-muted">Pendente</span><span className="text-warning-700">{formatCurrencyBRL(data.pendingCents)}</span></div>
      </div>

      {data.notes && (
        <div className="mt-4 border-t border-dashed border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Observações</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{data.notes}</p>
        </div>
      )}

      <p className="mt-4 border-t border-dashed border-line pt-3 text-center text-[11px] text-ink-faint">
        Documento simples de conferência. Não é documento fiscal.
      </p>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Nota simples" maxWidthClassName="max-w-lg">
      <div className="flex flex-col gap-4">
        {notePaper}

        <div className="simple-note-print-controls flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={handlePrintNote} loading={generating}>
            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>
      {typeof document !== "undefined" && createPortal(
        <div className="simple-note-print-document" aria-hidden="true">{notePaper}</div>,
        document.body
      )}
    </Modal>
  );
}
