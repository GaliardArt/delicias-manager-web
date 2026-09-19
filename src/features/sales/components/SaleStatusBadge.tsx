import { Badge } from "@/components/ui/Badge";

interface SaleStatusBadgeProps {
  totalCents: number;
  paidCents: number;
}

export function SaleStatusBadge({ totalCents, paidCents }: SaleStatusBadgeProps) {
  if (paidCents >= totalCents) {
    return <Badge tone="success">Pago</Badge>;
  }
  if (paidCents === 0) {
    return <Badge tone="warning">Fiado</Badge>;
  }
  return <Badge tone="warning">Parcial</Badge>;
}
