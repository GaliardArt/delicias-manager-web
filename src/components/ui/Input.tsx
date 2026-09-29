import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, wrapperClassName, label, error, id, ...props }, ref) => {
    return (
      <div className={cn("flex min-w-0 flex-col gap-1.5", wrapperClassName)}>
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-ink-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3.5 text-base text-ink outline-none transition-colors sm:text-sm",
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
