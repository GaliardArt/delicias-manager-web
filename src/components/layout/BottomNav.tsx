"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { navItems } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();
  const items = navItems.filter((item) => item.primaryMobile);

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur",
        "pb-safe pt-1.5 md:hidden"
      )}
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1"
              >
                <item.icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    active ? "text-brand-500" : "text-ink-faint"
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={cn(
                    "text-[10.5px] leading-none",
                    active ? "font-semibold text-brand-600" : "text-ink-faint"
                  )}
                >
                  {item.label === "Dias de Venda" ? "Dias" : item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
