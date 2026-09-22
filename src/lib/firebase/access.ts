import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "./config";
import { BOOTSTRAP_ADMIN_EMAIL } from "./users";
import { PermissionAction, PermissionModule } from "@/lib/permissions";

export async function requirePermission(
  module: PermissionModule,
  action: PermissionAction
): Promise<void> {
  const user = auth.currentUser;
  const uid = user?.uid;
  if (!uid) throw new Error("Usuário não autenticado.");

  if (user?.email?.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) return;

  const profileSnap = await getDoc(doc(db, "userProfiles", uid));
  if (!profileSnap.exists()) throw new Error("Perfil de acesso não encontrado.");
  const profile = profileSnap.data();

  if (profile.active === false) throw new Error("Este login está inativo.");
  if (profile.role === "admin") return;
  if (profile.permissions?.[module]?.[action] === true) return;

  throw new Error(`Seu login não possui permissão para ${action} em ${module}.`);
}
