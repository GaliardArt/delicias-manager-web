import { AppShell } from "@/components/layout/AppShell";
import { SaleForm } from "@/features/sales/components/SaleForm";

export default function NovaVendaPage() {
  return (
    <AppShell title="Nova venda">
      <SaleForm />
    </AppShell>
  );
}
