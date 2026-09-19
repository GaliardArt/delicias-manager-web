import { PaymentMethod } from "@/types";

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao: "Cartão",
  transferencia: "Transferência",
  fiado: "Fiado",
  outros: "Outros",
};

export const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao", label: "Cartão" },
  { value: "transferencia", label: "Transferência" },
  { value: "outros", label: "Outros" },
  { value: "fiado", label: "Fiado" },
];
