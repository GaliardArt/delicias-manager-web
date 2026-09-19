"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Button } from "@/components/ui/Button";
import { Product } from "@/types";
import { createProduct, updateProduct } from "@/lib/firebase/products";

const unitOptions = ["unidade", "caixa", "pacote", "kg", "dúzia"];

interface ProductFormProps {
  product?: Product;
  onSuccess: () => void;
}

export function ProductForm({ product, onSuccess }: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "unidade");
  const [priceCents, setPriceCents] = useState(product?.priceCents ?? 0);
  const [description, setDescription] = useState(product?.description ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome do produto.");
      return;
    }
    if (priceCents <= 0) {
      setError("Informe um preço maior que zero.");
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        category: category.trim() || "Geral",
        unit,
        priceCents,
        description: description.trim(),
      };
      if (product) {
        await updateProduct(product.id, input);
      } else {
        await createProduct(input);
      }
      onSuccess();
    } catch {
      setError("Não foi possível salvar o produto. Nenhum dado foi alterado.");
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
        placeholder="Brigadeiro gourmet"
        autoFocus
      />
      <Input
        label="Categoria"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Doces, Bolos, Biscoitos..."
      />
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label="Preço" valueCents={priceCents} onValueCentsChange={setPriceCents} />
        <Select label="Unidade" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {unitOptions.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Detalhes do produto"
      />
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-3.5 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <Button type="submit" loading={submitting} className="mt-1 w-full">
        {product ? "Salvar alterações" : "Cadastrar produto"}
      </Button>
    </form>
  );
}
