import {
  LayoutDashboard,
  ShoppingBag,
  PackageSearch,
  CalendarDays,
  Users,
  Cookie,
  BarChart3,
  Settings,
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  // Exibido nas 5 posições principais da barra inferior no Android
  primaryMobile?: boolean;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primaryMobile: true },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag, primaryMobile: true },
  { href: "/encomendas", label: "Encomendas", icon: PackageSearch, primaryMobile: true },
  { href: "/dias-de-venda", label: "Dias de Venda", icon: CalendarDays, primaryMobile: true },
  { href: "/clientes", label: "Clientes", icon: Users, primaryMobile: true },
  { href: "/produtos", label: "Produtos", icon: Cookie },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
