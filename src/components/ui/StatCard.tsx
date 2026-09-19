import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "brand" | "success" | "warning" | "neutral";
}

const toneClasses = {
  brand: "bg-babypink text-brand-600",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  neutral: "bg-surface-muted text-ink-muted",
};

export function StatCard({ label, value, icon: Icon, tone = "neutral" }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-ink-muted">{label}</p>
        <p className="font-display text-lg font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}
