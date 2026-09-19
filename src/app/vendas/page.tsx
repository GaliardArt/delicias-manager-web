import { ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function VendasPage() {
  return (
    <AppShell title="Vendas">
      <EmptyState
        icon={ShoppingBag}
        title="Nenhuma venda registrada ainda"
        description="O registro de vendas (Fase 3) será implementado aqui — cliente, produtos, quantidades e formas de pagamento em poucos passos."
        actionLabel="+ Nova venda"
      />
    </AppShell>
  );
}
