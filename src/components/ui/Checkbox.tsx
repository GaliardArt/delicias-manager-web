import { InputHTMLAttributes, forwardRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, checked, ...props }, ref) => {
    return (
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 transition-colors hover:bg-surface-muted",
          className
        )}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          className="sr-only"
          {...props}
        />
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
            checked ? "border-brand-500 bg-brand-500" : "border-line-strong bg-surface"
          )}
        >
          {checked && <Check className="h-3.5 w-3.5 text-white" />}
        </span>
        <span>
          <span className="block text-sm font-medium text-ink">{label}</span>
          {description && (
            <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
          )}
        </span>
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";
