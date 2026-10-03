"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Wheat, Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { InsumoForm } from "@/features/insumos/components/InsumoForm";
import { listInsumosPage } from "@/lib/firebase/insumos";
import { Insumo } from "@/types";
import { formatCurrencyBRL } from "@/lib/utils/format";
import { PaginationControls } from "@/components/ui/PaginationControls";
import type { QueryDocumentSnapshot } from "firebase/firestore";

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<Insumo[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<(QueryDocumentSnapshot | null)[]>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const nextCursor = useRef<QueryDocumentSnapshot | null>(null);

  async function load() {
    setError(false);
    setInsumos(null);
    try {
      const result = await listInsumosPage(cursors[page - 1] ?? null);
      setInsumos(result.items);
      setHasNextPage(result.hasMore);
      nextCursor.current = result.nextCursor;
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => { load(); }, [page]);

  const term = search.toLowerCase();
  const filtered = insumos?.filter((i) => i.name.toLowerCase().includes(term));

  return (
    <AppShell title="Insumos">
      <p className="mb-4 text-sm text-ink-muted">
        Matérias-primas compradas (farinha, leite condensado, cacau...). O custo
        por unidade é calculado a partir do preço pago.
      </p>

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Buscar nesta página"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="lg" className="w-full md:w-auto" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Novo insumo
        </Button>
      </div>

      {insumos === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={Wheat}
          title="Não foi possível carregar os insumos"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {insumos !== null && !error && filtered?.length === 0 && (
        <EmptyState
          icon={Wheat}
          title={search ? "Nenhum insumo encontrado" : "Nenhum insumo cadastrado ainda"}
          description={search ? "Tente buscar por outro nome." : "Cadastre o primeiro insumo para começar a montar receitas."}
          actionLabel={search ? undefined : "+ Novo insumo"}
          onAction={search ? undefined : () => setModalOpen(true)}
        />
      )}

      {filtered && filtered.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {filtered.map((insumo) => (
              <li key={insumo.id}>
                <Link
                  href={`/insumos/${insumo.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{insumo.name}</p>
                    <p className="text-xs text-ink-muted">
                      Estoque: {insumo.stockQuantity} {insumo.unit}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {formatCurrencyBRL(insumo.unitCostCents)}/{insumo.unit}
                    </span>
                    {!insumo.active && <Badge tone="neutral">Inativo</Badge>}
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {insumos !== null && insumos.length > 0 && (
        <PaginationControls
          page={page}
          hasPrevious={page > 1}
          hasNext={hasNextPage}
          onPrevious={() => setPage((value) => Math.max(1, value - 1))}
          onNext={() => {
            if (!nextCursor.current) return;
            setCursors((value) => [...value.slice(0, page), nextCursor.current]);
            setPage((value) => value + 1);
          }}
        />
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo insumo" maxWidthClassName="max-w-lg" fixedContent>
        <InsumoForm
          onSuccess={(savedInsumo) => {
            setModalOpen(false);
            setInsumos((current) => current
              ? [...current.filter((item) => item.id !== savedInsumo.id), savedInsumo].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 25)
              : [savedInsumo]);
          }}
        />
      </Modal>
    </AppShell>
  );
}
