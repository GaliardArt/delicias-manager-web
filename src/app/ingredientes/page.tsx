"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Blend, Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { IngredienteForm } from "@/features/ingredientes/components/IngredienteForm";
import { listAllIngredientes } from "@/lib/firebase/ingredientes";
import { listAllInsumos } from "@/lib/firebase/insumos";
import { Ingrediente, Insumo } from "@/types";
import { formatCurrencyBRL } from "@/lib/utils/format";

export default function IngredientesPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[] | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setError(false);
    setIngredientes(null);
    try {
      const [ing, ins] = await Promise.all([listAllIngredientes(), listAllInsumos()]);
      setIngredientes(ing);
      setInsumos(ins);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const term = search.toLowerCase();
  const filtered = ingredientes?.filter((i) => i.name.toLowerCase().includes(term));

  return (
    <AppShell title="Ingredientes">
      <p className="mb-4 text-sm text-ink-muted">
        Ingredientes são feitos a partir de uma receita de insumos (e podem usar
        outros ingredientes) — o custo é calculado automaticamente.
      </p>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Buscar por nome"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="lg" className="w-full md:w-auto" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Novo ingrediente
        </Button>
      </div>

      {ingredientes === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={Blend}
          title="Não foi possível carregar os ingredientes"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {ingredientes !== null && !error && filtered?.length === 0 && (
        <EmptyState
          icon={Blend}
          title={search ? "Nenhum ingrediente encontrado" : "Nenhum ingrediente cadastrado ainda"}
          description={
            search
              ? "Tente buscar por outro nome."
              : "Cadastre insumos primeiro, depois monte a receita de cada ingrediente aqui."
          }
          actionLabel={search ? undefined : "+ Novo ingrediente"}
          onAction={search ? undefined : () => setModalOpen(true)}
        />
      )}

      {filtered && filtered.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {filtered.map((ingrediente) => (
              <li key={ingrediente.id}>
                <Link
                  href={`/ingredientes/${ingrediente.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{ingrediente.name}</p>
                    <p className="text-xs text-ink-muted">
                      Estoque: {ingrediente.stockQuantity} {ingrediente.yieldUnit}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {formatCurrencyBRL(ingrediente.unitCostCents)}/{ingrediente.yieldUnit}
                    </span>
                    {!ingrediente.active && <Badge tone="neutral">Inativo</Badge>}
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo ingrediente">
        <IngredienteForm
          insumos={insumos}
          allIngredientes={ingredientes ?? []}
          onSuccess={() => {
            setModalOpen(false);
            load();
          }}
        />
      </Modal>
    </AppShell>
  );
}
