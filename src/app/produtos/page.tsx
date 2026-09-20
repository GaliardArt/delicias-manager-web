"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Cookie, Search, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ProductForm } from "@/features/products/components/ProductForm";
import { listAllProducts } from "@/lib/firebase/products";
import { Product } from "@/types";
import { formatCurrencyBRL } from "@/lib/utils/format";

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setError(false);
    setProducts(null);
    try {
      setProducts(await listAllProducts());
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const term = search.toLowerCase();
  const filtered = products?.filter(
    (p) => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term)
  );

  return (
    <AppShell title="Produtos">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Buscar por nome ou categoria"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button size="lg" className="w-full md:w-auto" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      </div>

      {products === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={Cookie}
          title="Não foi possível carregar os produtos"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {products !== null && !error && filtered?.length === 0 && (
        <EmptyState
          icon={Cookie}
          title={search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado ainda"}
          description={
            search
              ? "Tente buscar por outro nome ou categoria."
              : "Cadastre o primeiro produto para começar a registrar vendas."
          }
          actionLabel={search ? undefined : "+ Novo produto"}
          onAction={search ? undefined : () => setModalOpen(true)}
        />
      )}

      {filtered && filtered.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {filtered.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/produtos/${product.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                    <p className="text-xs text-ink-muted">{product.category}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {formatCurrencyBRL(product.priceCents)}
                    </span>
                    {!product.active && <Badge tone="neutral">Inativo</Badge>}
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo produto">
        <ProductForm
          onSuccess={() => {
            setModalOpen(false);
            load();
          }}
        />
      </Modal>
    </AppShell>
  );
}
