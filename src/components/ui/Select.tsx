import { SelectHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={cn(
              "h-11 w-full appearance-none rounded-xl border border-line bg-surface px-3.5 pr-9 text-sm text-ink outline-none transition-colors",
              "focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
              error && "border-danger-500 focus:border-danger-500 focus:ring-danger-50",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        </div>
        {error && <span className="text-xs text-danger-500">{error}</span>}
      </div>
    );
  }
);
Select.displayName = "Select";
