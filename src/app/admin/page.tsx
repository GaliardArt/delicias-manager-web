"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DatabaseZap,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useUserProfile } from "@/hooks/useUserProfile";
import { assertCurrentAdmin } from "@/lib/firebase/users";
import {
  clearExpenses,
  clearGeneralHistories,
  clearIngredientes,
  clearInsumos,
  clearProducts,
  clearSales,
  clearSalesDays,
} from "@/lib/firebase/cleanup";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  deletePendingUserAccess,
  listPendingUserAccess,
  listUserProfiles,
  removeUserProfile,
  saveUserAccessConfiguration,
  updateUserProfile,
  PendingUserAccess,
  UserProfile,
} from "@/lib/firebase/users";
import {
  createBasicUserPermissions,
  createAdminPermissions,
  PermissionAction,
  PermissionMap,
  permissionCatalog,
} from "@/lib/permissions";

interface CleanupAction {
  key: string;
  label: string;
  description: string;
  icon: typeof DatabaseZap;
  run: () => Promise<unknown>;
}

function clonePermissions(value: PermissionMap): PermissionMap {
  return JSON.parse(JSON.stringify(value)) as PermissionMap;
}

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading } = useUserProfile();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUserAccess[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingPending, setEditingPending] = useState<PendingUserAccess | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState<CleanupAction | null>(null);
  const [confirmUser, setConfirmUser] = useState<UserProfile | null>(null);
  const [confirmPending, setConfirmPending] = useState<PendingUserAccess | null>(null);

  const cleanupActions: CleanupAction[] = useMemo(
    () => [
      {
        key: "products",
        label: "Limpar produtos",
        description: "Apaga definitivamente todos os produtos cadastrados.",
        icon: Trash2,
        run: clearProducts,
      },
      {
        key: "insumos",
        label: "Limpar insumos",
        description: "Apaga definitivamente todos os insumos e seus estoques.",
        icon: Trash2,
        run: clearInsumos,
      },
      {
        key: "ingredientes",
        label: "Limpar ingredientes",
        description: "Apaga definitivamente todos os ingredientes cadastrados.",
        icon: Trash2,
        run: clearIngredientes,
      },
      {
        key: "sales",
        label: "Limpar vendas",
        description: "Apaga todas as vendas e os pagamentos vinculados a elas.",
        icon: DatabaseZap,
        run: clearSales,
      },
      {
        key: "sales-days",
        label: "Limpar Dias de Venda",
        description: "Apaga todos os registros de Dias de Venda, inclusive os encerrados.",
        icon: DatabaseZap,
        run: clearSalesDays,
      },
      {
        key: "histories",
        label: "Limpar históricos gerais",
        description: "Remove a auditoria e as encomendas já concluídas ou canceladas.",
        icon: DatabaseZap,
        run: clearGeneralHistories,
      },
      {
        key: "expenses",
        label: "Limpar contas",
        description: "Apaga definitivamente todas as contas/despesas registradas.",
        icon: Trash2,
        run: clearExpenses,
      },
    ],
    []
  );

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const [profiles, pending] = await Promise.all([
        listUserProfiles(),
        listPendingUserAccess(),
      ]);
      setUsers(profiles);
      setPendingUsers(pending);
      setMessage(null);
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Não foi possível carregar os acessos.");
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function verifyAccess() {
      if (loading) return;
      try {
        const adminProfile = await assertCurrentAdmin();
        if (!cancelled && adminProfile.role === "admin") {
          await loadUsers();
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) router.replace("/dashboard");
      }
    }
    verifyAccess();
    return () => { cancelled = true; };
  }, [loading, router]);

  if (loading) {
    return (
      <AppShell title="Painel ADM">
        <div className="flex items-center justify-center py-16 text-sm text-ink-muted">
          Verificando acesso administrativo...
        </div>
      </AppShell>
    );
  }

  if (!profile) return null;
  if (profile.role !== "admin") return null;

  async function handleCleanup() {
    if (!confirmCleanup) return;
    setMessage(null);
    try {
      const result = await confirmCleanup.run();
      if (typeof result === "number") {
        setMessage(`${result} registro(s) foram removidos.`);
      } else if (result && typeof result === "object") {
        const data = result as { activities?: number; orders?: number };
        setMessage(
          `${data.activities ?? 0} atividades e ${data.orders ?? 0} encomendas históricas foram removidas.`
        );
      } else {
        setMessage("Limpeza concluída.");
      }
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Não foi possível concluir a limpeza.");
    } finally {
      setConfirmCleanup(null);
    }
  }

  function openCreateAccess() {
    setEditingUser(null);
    setEditingPending(null);
    setUserModalOpen(true);
  }

  function openEditUser(user: UserProfile) {
    setEditingUser(user);
    setEditingPending(null);
    setUserModalOpen(true);
  }

  function openEditPending(pending: PendingUserAccess) {
    setEditingUser(null);
    setEditingPending(pending);
    setUserModalOpen(true);
  }

  async function handleAccessSaved() {
    setUserModalOpen(false);
    setEditingUser(null);
    setEditingPending(null);
    await loadUsers();
  }

  async function handleRemoveProfile() {
    if (!confirmUser) return;
    try {
      await removeUserProfile(confirmUser.uid);
      setUsers((current) => current.filter((user) => user.uid !== confirmUser.uid));
      setMessage(
        "Perfil removido. A conta do Firebase Authentication continua existindo; sem uma nova configuração de acesso, ela ficará sem permissões do sistema."
      );
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Não foi possível remover o perfil.");
    } finally {
      setConfirmUser(null);
    }
  }

  async function handleRemovePending() {
    if (!confirmPending) return;
    try {
      await deletePendingUserAccess(confirmPending.email);
      setPendingUsers((current) => current.filter((item) => item.email !== confirmPending.email));
      setMessage("Configuração de acesso pendente removida.");
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Não foi possível remover a configuração.");
    } finally {
      setConfirmPending(null);
    }
  }

  return (
    <AppShell title="Painel ADM">
      <div className="flex flex-col gap-5">
        <Card className="border-brand-100 bg-brand-50/40">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-babypink text-brand-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display font-semibold text-ink">Área administrativa</p>
              <p className="mt-1 text-sm text-ink-muted">
                Cadastre e-mails e senhas no Firebase Authentication. Aqui você define nomes,
                cargos, abas e ações permitidas para cada acesso.
              </p>
            </div>
          </div>
        </Card>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Limpeza</h2>
              <p className="text-sm text-ink-muted">
                Ações permanentes. Use somente quando realmente quiser zerar os dados.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cleanupActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card key={action.key} className="flex flex-col justify-between">
                  <div>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger-50 text-danger-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-semibold text-ink">{action.label}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{action.description}</p>
                  </div>
                  <Button
                    variant="danger"
                    className="mt-4 w-full"
                    onClick={() => setConfirmCleanup(action)}
                  >
                    Limpar
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">Logins e permissões</h2>
              <p className="text-sm text-ink-muted">
                O Firebase Authentication guarda o login. O Delícias Manager guarda somente o
                perfil, cargo, foto e permissões.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={loadUsers} disabled={loadingUsers}>
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Button size="sm" onClick={openCreateAccess}>
                <Plus className="h-4 w-4" /> Configurar acesso
              </Button>
            </div>
          </div>

          {message && (
            <p className="mb-3 rounded-xl bg-surface-muted p-3 text-sm text-ink-muted">{message}</p>
          )}

          {loadingUsers ? (
            <div className="flex items-center justify-center rounded-2xl border border-line bg-surface py-10 text-sm text-ink-muted">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Carregando acessos...
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Usuários que já entraram no sistema</CardTitle>
                    <p className="mt-1 text-sm text-ink-muted">
                      Esses perfis já estão vinculados a uma conta do Firebase Authentication.
                    </p>
                  </div>
                </CardHeader>
                {users.length === 0 ? (
                  <div className="py-5 text-center">
                    <Users className="mx-auto mb-2 h-7 w-7 text-ink-faint" />
                    <p className="font-medium text-ink">Nenhum perfil encontrado</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      O primeiro acesso administrativo já está reservado para {BOOTSTRAP_ADMIN_EMAIL}.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {users.map((user) => (
                      <Card key={user.uid} className="flex flex-col gap-3 bg-surface-muted/40 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-babypink text-brand-600">
                            {user.photoUrl ? (
                              <img src={user.photoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <UserCog className="h-5 w-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{user.name || user.email}</p>
                            <p className="truncate text-sm text-ink-muted">{user.email}</p>
                            <p className="text-xs text-ink-faint">
                              {user.role === "admin" ? "Administrador" : user.cargo || "Sem cargo"} · {user.active ? "Ativo" : "Inativo"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:shrink-0">
                          <Button variant="secondary" size="sm" onClick={() => openEditUser(user)}>
                            Editar acesso
                          </Button>
                          {user.email.toLowerCase() !== BOOTSTRAP_ADMIN_EMAIL && (
                            <Button variant="ghost" size="sm" onClick={() => setConfirmUser(user)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Configurações por e-mail</CardTitle>
                    <p className="mt-1 text-sm text-ink-muted">
                      Use isto para preparar as permissões antes do primeiro acesso. O e-mail ainda precisa existir no Firebase Authentication.
                    </p>
                  </div>
                </CardHeader>
                {pendingUsers.length === 0 ? (
                  <p className="py-5 text-center text-sm text-ink-muted">
                    Nenhuma configuração aguardando primeiro acesso.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {pendingUsers.map((pending) => (
                      <Card key={pending.email} className="flex flex-col gap-3 bg-surface-muted/40 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-babypink text-brand-700">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{pending.name || pending.email}</p>
                            <p className="truncate text-sm text-ink-muted">{pending.email}</p>
                            <p className="text-xs text-ink-faint">
                              {pending.role === "admin" ? "Administrador" : pending.cargo || "Sem cargo"} · aguardando primeiro acesso
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:shrink-0">
                          <Button variant="secondary" size="sm" onClick={() => openEditPending(pending)}>
                            Editar configuração
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmPending(pending)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </section>
      </div>

      <UserAccessModal
        open={userModalOpen}
        user={editingUser}
        pending={editingPending}
        onClose={() => {
          setUserModalOpen(false);
          setEditingUser(null);
          setEditingPending(null);
        }}
        onSaved={handleAccessSaved}
      />

      <ConfirmDialog
        open={confirmCleanup !== null}
        onClose={() => setConfirmCleanup(null)}
        title={confirmCleanup?.label ?? "Limpar dados"}
        description={`Essa ação é permanente. ${confirmCleanup?.description ?? "Os dados selecionados serão removidos."} Deseja continuar?`}
        confirmLabel="Limpar definitivamente"
        danger
        onConfirm={handleCleanup}
      />

      <ConfirmDialog
        open={confirmUser !== null}
        onClose={() => setConfirmUser(null)}
        title="Remover perfil de acesso"
        description={`O perfil de ${confirmUser?.email ?? "este usuário"} será removido do sistema. A conta correspondente do Firebase Authentication não será apagada por esta ação.`}
        confirmLabel="Remover perfil"
        danger
        onConfirm={handleRemoveProfile}
      />

      <ConfirmDialog
        open={confirmPending !== null}
        onClose={() => setConfirmPending(null)}
        title="Remover configuração"
        description={`A configuração de acesso de ${confirmPending?.email ?? "este e-mail"} será excluída antes do primeiro acesso.`}
        confirmLabel="Remover configuração"
        danger
        onConfirm={handleRemovePending}
      />
    </AppShell>
  );
}

function UserAccessModal({
  open,
  user,
  pending,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: UserProfile | null;
  pending: PendingUserAccess | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [cargo, setCargo] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [active, setActive] = useState(true);
  const [permissions, setPermissions] = useState<PermissionMap>(createBasicUserPermissions());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const source = user ?? pending;
    setEmail(source?.email ?? "");
    setName(source?.name ?? "");
    setCargo(source?.cargo ?? "");
    setRole(source?.role ?? "user");
    setActive(source?.active ?? true);
    setPermissions(source ? clonePermissions(source.permissions) : createBasicUserPermissions());
    setError(null);
  }, [open, user, pending]);

  function togglePermission(module: string, action: PermissionAction, checked: boolean) {
    setPermissions((current) => {
      const next = clonePermissions(current);
      next[module as keyof PermissionMap][action] = checked;
      return next;
    });
  }

  function setModule(module: keyof PermissionMap, checked: boolean) {
    setPermissions((current) => {
      const next = clonePermissions(current);
      for (const action of Object.keys(next[module])) {
        next[module][action as PermissionAction] = checked;
      }
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !name.trim()) {
      setError("Preencha e-mail e nome.");
      return;
    }

    setSubmitting(true);
    try {
      if (user) {
        await updateUserProfile(user.uid, {
          name: name.trim(),
          cargo: cargo.trim(),
          role,
          active,
          permissions: role === "admin" ? createAdminPermissions() : permissions,
        });
      } else {
        await saveUserAccessConfiguration({
          email: email.trim(),
          name: name.trim(),
          cargo: cargo.trim(),
          role,
          active,
          permissions: role === "admin" ? createAdminPermissions() : permissions,
        });
      }
      await onSaved();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Não foi possível salvar o acesso.");
    } finally {
      setSubmitting(false);
    }
  }

  const isEditingExisting = Boolean(user);
  const isEditingPending = Boolean(pending);
  const isBootstrap = (user?.email ?? email).trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditingExisting ? "Editar acesso" : "Configurar acesso por e-mail"}
      maxWidthClassName="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {!isEditingExisting && (
          <Card className="border-brand-100 bg-brand-50/40 p-3">
            <p className="text-sm text-ink-muted">
              Esta tela não cria usuários nem senhas. Cadastre primeiro o e-mail e a senha no
              <strong className="text-ink"> Firebase Authentication</strong>. Depois configure aqui as permissões; o acesso será aplicado quando o usuário entrar pela primeira vez.
            </p>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            id="admin-email"
            label="E-mail do Firebase Authentication"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isEditingExisting || isEditingPending}
            required
          />
          <Input
            id="admin-name"
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            id="admin-cargo"
            label="Cargo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Ex.: Vendedor"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Checkbox
            id="admin-role"
            label="Administrador"
            description="Acesso completo a todas as abas e ações."
            checked={role === "admin" || isBootstrap}
            disabled={isBootstrap}
            onChange={(e) => {
              const nextRole = e.target.checked ? "admin" : "user";
              setRole(nextRole);
              if (nextRole === "admin") setPermissions(createAdminPermissions());
            }}
          />
          <Checkbox
            id="admin-active"
            label="Acesso ativo"
            description="Usuários inativos não conseguem utilizar o sistema."
            checked={active || isBootstrap}
            disabled={isBootstrap}
            onChange={(e) => setActive(e.target.checked)}
          />
        </div>

        <div>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-ink">Abas e opções</h3>
              <p className="text-sm text-ink-muted">
                Defina exatamente o que este acesso poderá ver e executar.
              </p>
            </div>
            {role === "admin" || isBootstrap ? (
              <span className="rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
                Acesso total
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {permissionCatalog
              .filter((module) => module.key !== "admin")
              .map((module) => {
                const modulePermissions = permissions[module.key] ?? {};
                const allChecked = module.actions.every(
                  (action) => modulePermissions[action.key] === true
                );
                const fullAccess = role === "admin" || isBootstrap;
                return (
                  <Card key={module.key} className="p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">{module.label}</p>
                      <button
                        type="button"
                        onClick={() => setModule(module.key, !allChecked)}
                        disabled={fullAccess}
                        className="text-xs font-medium text-brand-600 disabled:opacity-50"
                      >
                        {allChecked ? "Desmarcar tudo" : "Marcar tudo"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {module.actions.map((action) => (
                        <Checkbox
                          key={`${module.key}-${action.key}`}
                          id={`permission-${module.key}-${action.key}`}
                          label={action.label}
                          checked={fullAccess ? true : modulePermissions[action.key] === true}
                          disabled={fullAccess}
                          onChange={(e) => togglePermission(module.key, action.key, e.target.checked)}
                          className="px-2.5 py-2"
                        />
                      ))}
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>

        {error && <p className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            Salvar acesso
          </Button>
        </div>
      </form>
    </Modal>
  );
}
