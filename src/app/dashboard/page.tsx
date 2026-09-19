import {
  ShoppingBag,
  Wallet,
  Clock,
  HandCoins,
  ArrowRight,
  CalendarDays,
  ShoppingCart,
  CreditCard,
  PackagePlus,
  UserPlus,
  Ban,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { mockDashboard } from "@/lib/mock/dashboard";
import { formatCurrencyBRL, formatDateBR } from "@/lib/utils/format";
import { orderStatusLabel, orderStatusTone } from "@/lib/utils/order-status";
import { ActivityType } from "@/types";
import Link from "next/link";

const activityIcon: Record<ActivityType, typeof ShoppingCart> = {
  venda_criada: ShoppingCart,
  pagamento_recebido: CreditCard,
  encomenda_criada: PackagePlus,
  cliente_cadastrado: UserPlus,
  pedido_cancelado: Ban,
};

export default function DashboardPage() {
  const data = mockDashboard;

  return (
    <AppShell title="Dashboard">
      {/* Indicadores principais */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Vendas hoje"
          value={formatCurrencyBRL(data.todaySalesCents)}
          icon={ShoppingBag}
          tone="brand"
        />
        <StatCard
          label="Recebido"
          value={formatCurrencyBRL(data.todayReceivedCents)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Pendente"
          value={formatCurrencyBRL(data.pendingCents)}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Fiado"
          value={formatCurrencyBRL(data.fiadoCents)}
          icon={HandCoins}
          tone="neutral"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Próximo Dia de Venda */}
        {data.nextSalesDay && (
          <Card>
            <CardHeader>
              <CardTitle>Próximo Dia de Venda</CardTitle>
              <Badge tone="brand">{formatDateBR(data.nextSalesDay.date)}</Badge>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-ink-muted">Pedidos</p>
                <p className="font-display text-base font-semibold text-ink">
                  {data.nextSalesDay.ordersCount}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Esperado</p>
                <p className="font-display text-base font-semibold text-ink">
                  {formatCurrencyBRL(data.nextSalesDay.expectedCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Recebido</p>
                <p className="font-display text-base font-semibold text-success-700">
                  {formatCurrencyBRL(data.nextSalesDay.receivedCents)}
                </p>
              </div>
              <div>
                <p className="text-ink-muted">Pendente</p>
                <p className="font-display text-base font-semibold text-warning-700">
                  {formatCurrencyBRL(data.nextSalesDay.pendingCents)}
                </p>
              </div>
            </div>
            <Link
              href="/dias-de-venda"
              className="mt-4 flex items-center gap-1 text-sm font-medium text-brand-600"
            >
              Ver Dia de Venda <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Card>
        )}

        {/* Próximas encomendas */}
        <Card>
          <CardHeader>
            <CardTitle>Próximas encomendas</CardTitle>
          </CardHeader>
          <ul className="flex flex-col divide-y divide-line">
            {data.upcomingOrders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{order.customerName}</p>
                  <p className="text-xs text-ink-muted">{formatDateBR(order.expectedDate)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {formatCurrencyBRL(order.totalCents)}
                  </span>
                  <Badge tone={orderStatusTone[order.status]}>
                    {orderStatusLabel[order.status]}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
          <Link
            href="/encomendas"
            className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-600"
          >
            Ver todas as encomendas <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      </div>

      {/* Atividades recentes */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Atividades recentes</CardTitle>
        </CardHeader>
        <ul className="flex flex-col divide-y divide-line">
          {data.recentActivity.map((activity) => {
            const Icon = activityIcon[activity.type];
            return (
              <li key={activity.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-babypink text-brand-600">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm text-ink">{activity.description}</p>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Ações rápidas — mobile-first, ficam acessíveis com uma mão */}
      <div className="mt-5 grid grid-cols-2 gap-3 md:hidden">
        <Button size="lg" className="w-full">
          <CalendarDays className="h-4 w-4" /> Nova venda
        </Button>
        <Button variant="secondary" size="lg" className="w-full">
          <PackagePlus className="h-4 w-4" /> Nova encomenda
        </Button>
      </div>
    </AppShell>
  );
}
