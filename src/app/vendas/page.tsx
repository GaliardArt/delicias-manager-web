"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ShoppingBag, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SaleStatusBadge } from "@/features/sales/components/SaleStatusBadge";
import { listRecentSales, SaleListItem } from "@/lib/firebase/sales";
import { formatCurrencyBRL, formatDateTimeBR } from "@/lib/utils/format";

export default function VendasPage() {
  const [sales, setSales] = useState<SaleListItem[] | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setError(false);
    setSales(null);
    try {
      const data = await listRecentSales();
      setSales(data);
    } catch (err) {
      console.error(err);
      setError(true);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = sales?.filter((s) =>
    s.customerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell title="Vendas">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="Buscar por cliente"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Link href="/vendas/nova" className="w-full md:w-auto">
          <Button size="lg" className="w-full md:w-auto">
            <Plus className="h-4 w-4" /> Nova venda
          </Button>
        </Link>
      </div>

      {sales === null && !error && (
        <div className="flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-muted" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={ShoppingBag}
          title="Não foi possível carregar as vendas"
          description="Verifique sua conexão ou as credenciais do Firebase."
          actionLabel="Tentar novamente"
          onAction={load}
        />
      )}

      {sales !== null && !error && filtered?.length === 0 && (
        <EmptyState
          icon={ShoppingBag}
          title={search ? "Nenhuma venda encontrada" : "Nenhuma venda registrada ainda"}
          description={
            search
              ? "Tente buscar por outro nome de cliente."
              : "Registre a primeira venda para começar a acompanhar o faturamento."
          }
          actionLabel={search ? undefined : "+ Nova venda"}
          onAction={search ? undefined : () => (window.location.href = "/vendas/nova")}
        />
      )}

      {filtered && filtered.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {filtered.map((sale) => (
              <li key={sale.id}>
                <Link
                  href={`/vendas/${sale.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{sale.customerName}</p>
                    <p className="text-xs text-ink-muted">
                      {formatDateTimeBR(sale.createdAt)} · {sale.itemsCount}{" "}
                      {sale.itemsCount === 1 ? "item" : "itens"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-ink">
                      {formatCurrencyBRL(sale.totalCents)}
                    </span>
                    <SaleStatusBadge totalCents={sale.totalCents} paidCents={sale.paidCents} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </AppShell>
  );
}
