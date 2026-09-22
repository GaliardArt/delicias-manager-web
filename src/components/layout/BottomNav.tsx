"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { navItems } from "./nav-items";
import { useUserProfile } from "@/hooks/useUserProfile";

export function BottomNav() {
  const pathname = usePathname();
  const { profile, loading } = useUserProfile();
  const items = navItems.filter((item) => item.primaryMobile && (loading || !profile || profile.role === "admin" || profile.permissions[item.href.slice(1) as keyof typeof profile.permissions]?.view === true));
  const isMoreActive = items.every((item) => !pathname.startsWith(item.href));

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur",
        "pb-safe pt-1.5 md:hidden"
      )}
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <ul className="grid grid-cols-5">
        {items.slice(0, 4).map((item) => {
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
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/mais"
            className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1"
          >
            <LayoutGrid
              className={cn(
                "h-6 w-6 transition-colors",
                isMoreActive && pathname.startsWith("/mais") ? "text-brand-500" : "text-ink-faint"
              )}
              strokeWidth={isMoreActive && pathname.startsWith("/mais") ? 2.4 : 2}
            />
            <span
              className={cn(
                "text-[10.5px] leading-none",
                isMoreActive && pathname.startsWith("/mais")
                  ? "font-semibold text-brand-600"
                  : "text-ink-faint"
              )}
            >
              Mais
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
