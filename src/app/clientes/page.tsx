"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Users, Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CustomerForm } from "@/features/customers/components/CustomerForm";
import { listCustomersPage, primeCustomersCache } from "@/lib/firebase/customers";
import { Customer } from "@/types";
import { formatPhoneBR } from "@/lib/utils/format";
import { PaginationControls } from "@/components/ui/PaginationControls";
import type { QueryDocumentSnapshot } from "firebase/firestore";

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<(QueryDocumentSnapshot | null)[]>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);

  async function load() {
    setError(false);
    setCustomers(null);
    try {
      const result = await listCustomersPage(cursors[page - 1] ?? null);
      setCustomers(result.items);
      setHasNextPage(result.hasMore);
      nextCursor.current = result.nextCursor;
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  const nextCursor = useRef<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    load();
  }, [page]);

  const term = search.toLowerCase();
  const filtered = customers?.filter(
    (c) => c.name.toLowerCase().includes(term) || c.phone.includes(term)
  );

  return (
    <AppShell title="Clientes">
      <p className="mb-3 text-xs text-ink-muted">Página atual em cache. Use Atualizar para buscar dados recentes.</p>
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
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </div>

      {customers === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={Users}
          title="Não foi possível carregar os clientes"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {customers !== null && !error && filtered?.length === 0 && (
        <EmptyState
          icon={Users}
          title={search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}
          description={
            search
              ? "Tente buscar por outro nome ou telefone."
              : "Cadastre o primeiro cliente para começar a registrar vendas."
          }
          actionLabel={search ? undefined : "+ Novo cliente"}
          onAction={search ? undefined : () => setModalOpen(true)}
        />
      )}

      {filtered && filtered.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {filtered.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/clientes/${customer.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{customer.name}</p>
                    <p className="text-xs text-ink-muted">{formatPhoneBR(customer.phone)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!customer.active && <Badge tone="neutral">Inativo</Badge>}
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {customers !== null && customers.length > 0 && (
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo cliente" maxWidthClassName="max-w-sm" fixedContent>
        <CustomerForm
          onSuccess={(savedCustomer) => {
            setModalOpen(false);
            if (customers === null) {
              load();
              return;
            }
            const updated = [...(customers ?? []).filter((customer) => customer.id !== savedCustomer.id), savedCustomer]
              .sort((a, b) => a.name.localeCompare(b.name));
            setCustomers(updated);
            primeCustomersCache(updated);
          }}
        />
      </Modal>
    </AppShell>
  );
}
