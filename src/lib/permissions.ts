export type PermissionAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "payment"
  | "stock"
  | "close"
  | "share";

export type PermissionModule =
  | "dashboard"
  | "vendas"
  | "encomendas"
  | "clientes"
  | "dias-de-venda"
  | "produtos"
  | "insumos"
  | "ingredientes"
  | "contas"
  | "relatorios"
  | "configuracoes"
  | "admin"
  | "perfil";

export type PermissionMap = Record<PermissionModule, Partial<Record<PermissionAction, boolean>>>;

export interface PermissionModuleConfig {
  key: PermissionModule;
  label: string;
  actions: { key: PermissionAction; label: string }[];
}

export const permissionCatalog: PermissionModuleConfig[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    actions: [{ key: "view", label: "Ver" }],
  },
  {
    key: "vendas",
    label: "Vendas",
    actions: [
      { key: "view", label: "Ver" },
      { key: "create", label: "Criar" },
      { key: "edit", label: "Editar" },
      { key: "delete", label: "Excluir" },
      { key: "payment", label: "Receber pagamento" },
    ],
  },
  {
    key: "encomendas",
    label: "Encomendas",
    actions: [
      { key: "view", label: "Ver" },
      { key: "create", label: "Criar" },
      { key: "edit", label: "Editar/status" },
      { key: "delete", label: "Excluir" },
      { key: "payment", label: "Receber pagamento" },
    ],
  },
  {
    key: "clientes",
    label: "Clientes",
    actions: [
      { key: "view", label: "Ver" },
      { key: "create", label: "Criar" },
      { key: "edit", label: "Editar/ativar" },
      { key: "delete", label: "Excluir" },
    ],
  },
  {
    key: "dias-de-venda",
    label: "Dias de Venda",
    actions: [
      { key: "view", label: "Ver" },
      { key: "close", label: "Encerrar dia" },
    ],
  },
  {
    key: "produtos",
    label: "Produtos",
    actions: [
      { key: "view", label: "Ver" },
      { key: "create", label: "Criar" },
      { key: "edit", label: "Editar/ativar" },
      { key: "delete", label: "Excluir" },
      { key: "stock", label: "Ajustar estoque" },
    ],
  },
  {
    key: "insumos",
    label: "Insumos",
    actions: [
      { key: "view", label: "Ver" },
      { key: "create", label: "Criar" },
      { key: "edit", label: "Editar/ativar" },
      { key: "delete", label: "Excluir" },
      { key: "stock", label: "Estoque/compras" },
    ],
  },
  {
    key: "ingredientes",
    label: "Ingredientes",
    actions: [
      { key: "view", label: "Ver" },
      { key: "create", label: "Criar" },
      { key: "edit", label: "Editar/ativar" },
      { key: "delete", label: "Excluir" },
      { key: "stock", label: "Ajustar estoque" },
    ],
  },
  {
    key: "contas",
    label: "Contas",
    actions: [
      { key: "view", label: "Ver" },
      { key: "create", label: "Criar" },
      { key: "delete", label: "Excluir" },
    ],
  },
  {
    key: "relatorios",
    label: "Relatórios",
    actions: [
      { key: "view", label: "Ver" },
      { key: "share", label: "Compartilhar" },
    ],
  },
  {
    key: "configuracoes",
    label: "Configurações",
    actions: [{ key: "view", label: "Ver" }],
  },
  {
    key: "admin",
    label: "Painel ADM",
    actions: [{ key: "view", label: "Ver/gerenciar" }],
  },
  {
    key: "perfil",
    label: "Perfil",
    actions: [{ key: "view", label: "Ver/editar" }],
  },
];

export function createEmptyPermissions(): PermissionMap {
  return Object.fromEntries(
    permissionCatalog.map(({ key, actions }) => [
      key,
      Object.fromEntries(actions.map((action) => [action.key, false])),
    ])
  ) as PermissionMap;
}

export function createAdminPermissions(): PermissionMap {
  return Object.fromEntries(
    permissionCatalog.map(({ key, actions }) => [
      key,
      Object.fromEntries(actions.map((action) => [action.key, true])),
    ])
  ) as PermissionMap;
}

export function createBasicUserPermissions(): PermissionMap {
  const permissions = createEmptyPermissions();
  permissions.dashboard.view = true;
  permissions.configuracoes.view = true;
  permissions.perfil.view = true;
  return permissions;
}

export function normalizePermissions(value: unknown, admin = false): PermissionMap {
  const fallback = admin ? createAdminPermissions() : createBasicUserPermissions();
  if (!value || typeof value !== "object") return fallback;

  const source = value as Record<string, unknown>;
  const normalized = createEmptyPermissions();
  for (const moduleConfig of permissionCatalog) {
    const sourceModule = source[moduleConfig.key];
    if (!sourceModule || typeof sourceModule !== "object") continue;
    for (const action of moduleConfig.actions) {
      normalized[moduleConfig.key][action.key] =
        (sourceModule as Record<string, unknown>)[action.key] === true;
    }
  }

  if (admin) return createAdminPermissions();
  return { ...fallback, ...normalized };
}
