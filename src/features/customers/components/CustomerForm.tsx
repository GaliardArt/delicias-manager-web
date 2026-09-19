"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Customer } from "@/types";
import { createCustomer, updateCustomer } from "@/lib/firebase/customers";

interface CustomerFormProps {
  customer?: Customer;
  onSuccess: () => void;
}

export function CustomerForm({ customer, onSuccess }: CustomerFormProps) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    if (!phone.trim()) {
      setError("Informe o telefone do cliente.");
      return;
    }

    setSubmitting(true);
    try {
      const input = { name: name.trim(), phone: phone.trim(), address: address.trim(), notes: notes.trim() };
      if (customer) {
        await updateCustomer(customer.id, input);
      } else {
        await createCustomer(input);
      }
      onSuccess();
    } catch {
      setError("Não foi possível salvar o cliente. Nenhum dado foi alterado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        label="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Maria Silva"
        autoFocus
      />
      <Input
        label="Telefone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="(16) 99999-9999"
      />
      <Input
        label="Endereço (opcional)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Rua das Flores, 120"
      />
      <Input
        label="Observações (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Alergia a amendoim, por exemplo"
      />
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="mt-1 w-full">
        {customer ? "Salvar alterações" : "Cadastrar cliente"}
      </Button>
    </form>
  );
}
