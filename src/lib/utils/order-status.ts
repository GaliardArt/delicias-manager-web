import { OrderStatus } from "@/types";

export const orderStatusLabel: Record<OrderStatus, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  em_producao: "Em produção",
  pronta: "Pronta",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

export const orderStatusTone: Record<
  OrderStatus,
  "neutral" | "success" | "warning" | "danger" | "brand"
> = {
  pendente: "neutral",
  confirmada: "brand",
  em_producao: "warning",
  pronta: "success",
  entregue: "success",
  cancelada: "danger",
};
