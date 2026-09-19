import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DiasDeVendaPage() {
  return (
    <AppShell title="Dias de Venda">
      <EmptyState
        icon={CalendarDays}
        title="Nenhum Dia de Venda criado ainda"
        description="A organização por Dia de Venda (Fase 5) será implementada aqui — pedidos agrupados por endereço, valores esperados e fechamento."
        actionLabel="+ Novo Dia de Venda"
      />
    </AppShell>
  );
}
