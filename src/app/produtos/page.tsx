import { Cookie } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ProdutosPage() {
  return (
    <AppShell title="Produtos">
      <EmptyState
        icon={Cookie}
        title="Nenhum produto cadastrado ainda"
        description="O cadastro de produtos (Fase 2) será implementado aqui — categoria, preço, unidade e histórico de vendas."
        actionLabel="+ Novo produto"
      />
    </AppShell>
  );
}
