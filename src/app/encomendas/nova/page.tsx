import { AppShell } from "@/components/layout/AppShell";
import { OrderForm } from "@/features/orders/components/OrderForm";

export default function NovaEncomendaPage() {
  return (
    <AppShell title="Nova encomenda">
      <OrderForm />
    </AppShell>
  );
}
