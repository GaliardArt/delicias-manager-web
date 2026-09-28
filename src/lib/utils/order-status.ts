import { OrderStatus } from "@/types";

export function normalizeOrderStatus(status: unknown): OrderStatus {
  switch (status) {
    case "finalizada":
    case "entregue":
      return "finalizada";
    case "cancelada":
      return "cancelada";
    case "em_producao":
    case "pendente":
    case "confirmada":
    case "pronta":
    default:
      return "em_producao";
  }
}

export const orderStatusLabel: Record<OrderStatus, string> = {
  em_producao: "Em produção",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export const orderStatusTone: Record<
  OrderStatus,
  "neutral" | "success" | "warning" | "danger" | "brand"
> = {
  em_producao: "warning",
  finalizada: "success",
  cancelada: "danger",
};
