import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "h-11 rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-colors",
            "placeholder:text-ink-faint",
            "focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
            error && "border-danger-500 focus:border-danger-500 focus:ring-danger-50",
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-danger-500">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
