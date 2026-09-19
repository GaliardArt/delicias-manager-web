import { Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ClientesPage() {
  return (
    <AppShell title="Clientes">
      <EmptyState
        icon={Users}
        title="Nenhum cliente cadastrado ainda"
        description="O cadastro e histórico de clientes (Fase 2) será implementado aqui — total comprado, ticket médio e pendências."
        actionLabel="+ Novo cliente"
      />
    </AppShell>
  );
}
