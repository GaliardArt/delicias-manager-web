// Tipos centrais do domínio, espelhando as coleções do Firestore (seção 19 da spec).
// Valores monetários são sempre armazenados em CENTAVOS (inteiros) para evitar
// erros de ponto flutuante (seção 33).

export type PaymentMethod =
  | "dinheiro"
  | "pix"
  | "cartao"
  | "transferencia"
  | "fiado"
  | "outros";

export type OrderStatus =
  | "pendente"
  | "confirmada"
  | "em_producao"
  | "pronta"
  | "entregue"
  | "cancelada";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  active: boolean;
  createdAt: string; // ISO date
}

export interface Product {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  unit: string; // unidade, caixa, pacote, kg, dúzia...
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Payment {
  id: string;
  amountCents: number;
  method: PaymentMethod;
  paidAt: string; // ISO date
  notes?: string;
}

export interface Sale {
  id: string;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  totalCents: number;
  paidCents: number; // derivado da soma dos pagamentos
  pendingCents: number; // totalCents - paidCents
  payments: Payment[];
  salesDayId?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  payments: Payment[];
  orderDate: string;
  expectedDate: string;
  salesDayId?: string;
  deliveryAddress?: string;
  notes?: string;
  status: OrderStatus;
}

export interface SalesDay {
  id: string;
  date: string; // ISO date
  expectedCents: number;
  receivedCents: number;
  pendingCents: number;
  cancelledCents: number;
  notRealizedCents: number;
  ordersCount: number;
  closed: boolean;
}

export type ActivityType =
  | "venda_criada"
  | "pagamento_recebido"
  | "encomenda_criada"
  | "cliente_cadastrado"
  | "pedido_cancelado";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  description: string;
  referenceId: string;
  createdAt: string;
}

export interface DashboardSummary {
  todaySalesCents: number;
  todayReceivedCents: number;
  pendingCents: number;
  fiadoCents: number;
  salesCount: number;
  upcomingOrders: Order[];
  nextSalesDay: SalesDay | null;
  recentActivity: ActivityEvent[];
}
