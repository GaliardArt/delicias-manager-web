import { AppShell } from "@/components/layout/AppShell";
import { SaleForm } from "@/features/sales/components/SaleForm";

export default function NovaEncomendaPage() {
  return (
    <AppShell title="Nova venda ou encomenda">
      <SaleForm initialIsOrder />
    </AppShell>
  );
}
