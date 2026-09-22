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

export interface RecipeItem {
  sourceType: "insumo" | "ingrediente";
  sourceId: string;
  sourceName: string;
  quantity: number; // sempre na unidade-base do insumo/ingrediente (unit/yieldUnit) — usada no cálculo de custo
  unit: string; // unidade-base do insumo/ingrediente referenciado
  enteredQuantity?: number; // quantidade como o usuário digitou originalmente (pode estar em outra unidade)
  enteredUnit?: string; // unidade escolhida pelo usuário ao montar a receita (ex: "g" para um insumo cuja base é "kg")
}

export interface Product {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  unit: string; // unidade, caixa, pacote, kg, dúzia...
  yieldQuantity: number; // quanto a receita rende, na unidade do produto
  description?: string;
  active: boolean;
  createdAt: string;
  recipeItems: RecipeItem[]; // receita (insumos e/ou ingredientes) — custo é calculado, nunca digitado
  stockQuantity: number; // estoque de produto pronto; pode ficar negativo
}

// Insumo = matéria-prima comprada (farinha, leite condensado, cacau...).
export interface Insumo {
  id: string;
  name: string;
  unit: string; // g, kg, ml, l, unidade...
  purchasePriceCents: number; // valor pago no último lote/compra
  purchaseQuantity: number; // quantidade daquele lote, na mesma unidade
  unitCostCents: number; // derivado: purchasePriceCents / purchaseQuantity
  stockQuantity: number;
  active: boolean;
  createdAt: string;
  // Conversão personalizada opcional, para quando `unit` é uma embalagem de
  // tamanho variável (ex: "caixa", "pacote") e a receita precisa referenciar
  // uma unidade menor (normalmente "unidade") — ex: packageUnit="unidade",
  // packageQuantity=30 significa "1 caixa = 30 unidades". Sem isso, só é
  // possível lançar a quantidade na receita na própria unidade-base.
  packageUnit?: string;
  packageQuantity?: number;
}

// Ingrediente = feito a partir de uma receita de insumos e/ou outros
// ingredientes (ex: brigadeiro, que depois entra na receita de um bolo).
export interface Ingrediente {
  id: string;
  name: string;
  yieldQuantity: number; // quanto a receita rende
  yieldUnit: string;
  recipeItems: RecipeItem[];
  unitCostCents: number; // custo por yieldUnit, calculado a partir da receita
  stockQuantity: number;
  active: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  description: string;
  category: string;
  amountCents: number;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number; // custo do produto no momento da venda, via receita
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
  | "pedido_cancelado"
  | "dia_venda_criado"
  | "dia_venda_encerrado";

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
