import {
  LayoutDashboard,
  ShoppingBag,
  PackageSearch,
  CalendarDays,
  Users,
  Cookie,
  Wheat,
  Blend,
  Receipt,
  BarChart3,
  Settings,
  ShieldCheck,
  UserCircle,
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  // Exibido nas 4 primeiras posições da barra inferior no Android — o resto
  // fica no menu "Mais" (5ª posição) e sempre na sidebar do desktop.
  primaryMobile?: boolean;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primaryMobile: true },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag, primaryMobile: true },
  { href: "/encomendas", label: "Encomendas", icon: PackageSearch, primaryMobile: true },
  { href: "/clientes", label: "Clientes", icon: Users, primaryMobile: true },
  { href: "/dias-de-venda", label: "Dias de Venda", icon: CalendarDays },
  { href: "/produtos", label: "Produtos", icon: Cookie },
  { href: "/insumos", label: "Insumos", icon: Wheat },
  { href: "/ingredientes", label: "Ingredientes", icon: Blend },
  { href: "/contas", label: "Contas", icon: Receipt },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
  { href: "/perfil", label: "Perfil", icon: UserCircle },
  { href: "/admin", label: "Painel ADM", icon: ShieldCheck },
];

// Itens que aparecem no menu "Mais" do mobile (tudo que não está na barra
// inferior principal, exceto Configurações — que já tem atalho próprio).
export const moreNavItems = navItems.filter(
  (item) => !item.primaryMobile && item.href !== "/configuracoes"
);
