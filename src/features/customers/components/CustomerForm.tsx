"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Customer } from "@/types";
import { createCustomer, updateCustomer } from "@/lib/firebase/customers";

interface CustomerFormProps {
  customer?: Customer;
  onSuccess: (savedCustomer: Customer) => void;
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
      let savedCustomer: Customer;
      if (customer) {
        await updateCustomer(customer.id, input);
        savedCustomer = { ...customer, ...input };
      } else {
        const id = await createCustomer(input);
        savedCustomer = { id, ...input, active: true, createdAt: new Date().toISOString() };
      }
      onSuccess(savedCustomer);
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o cliente. Nenhum dado foi alterado.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Input
        label="Nome"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Maria Silva"
        className="h-10 px-3 text-sm"
      />
      <Input
        label="Telefone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="(16) 99999-9999"
        className="h-10 px-3 text-sm"
      />
      <Input
        label="Endereço (opcional)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Rua das Flores, 120"
        className="h-10 px-3 text-sm"
      />
      <Input
        label="Observações (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Alergia a amendoim, por exemplo"
        className="h-10 px-3 text-sm"
      />
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="mt-0 h-10 w-full">
        {customer ? "Salvar alterações" : "Cadastrar cliente"}
      </Button>
    </form>
  );
}
