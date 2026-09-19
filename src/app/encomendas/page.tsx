import { PackageSearch } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function EncomendasPage() {
  return (
    <AppShell title="Encomendas">
      <EmptyState
        icon={PackageSearch}
        title="Nenhuma encomenda encontrada"
        description="A gestão de encomendas (Fase 4) será implementada aqui — status, datas previstas e vínculo com o Dia de Venda."
        actionLabel="+ Nova encomenda"
      />
    </AppShell>
  );
}
