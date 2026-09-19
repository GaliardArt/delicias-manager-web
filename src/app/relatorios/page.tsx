import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";

export default function RelatoriosPage() {
  return (
    <AppShell title="Relatórios">
      <EmptyState
        icon={BarChart3}
        title="Dados insuficientes para gerar relatórios"
        description="Os relatórios de vendas, produtos, clientes e tendências (Fase 7 e 8) aparecerão aqui assim que houver dados reais — incluindo o resumo compartilhável no WhatsApp."
      />
    </AppShell>
  );
}
