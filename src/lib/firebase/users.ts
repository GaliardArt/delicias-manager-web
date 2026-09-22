import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "./config";
import {
  createAdminPermissions,
  createBasicUserPermissions,
  normalizePermissions,
  PermissionMap,
} from "@/lib/permissions";

export const BOOTSTRAP_ADMIN_EMAIL = "adm@adm.com";

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  photoUrl?: string;
  cargo: string;
  role: "admin" | "user";
  active: boolean;
  permissions: PermissionMap;
  createdAt?: string;
  updatedAt?: string;
}

export interface PendingUserAccess {
  email: string;
  name: string;
  cargo: string;
  role: "admin" | "user";
  active: boolean;
  permissions: PermissionMap;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapProfile(id: string, data: Record<string, any>): UserProfile {
  const role = data.role === "admin" ? "admin" : "user";
  return {
    uid: id,
    email: String(data.email ?? ""),
    name: String(data.name ?? ""),
    photoUrl:
      typeof data.photoUrl === "string" && data.photoUrl
        ? data.photoUrl
        : undefined,
    cargo: String(data.cargo ?? (role === "admin" ? "Administrador" : "")),
    role,
    active: data.active !== false,
    permissions: normalizePermissions(data.permissions, role === "admin"),
    createdAt: data.createdAt?.toDate?.()?.toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
  };
}

function mapPendingAccess(
  id: string,
  data: Record<string, any>
): PendingUserAccess {
  const role = data.role === "admin" ? "admin" : "user";
  return {
    email: String(data.email ?? id),
    name: String(data.name ?? ""),
    cargo: String(data.cargo ?? (role === "admin" ? "Administrador" : "")),
    role,
    active: data.active !== false,
    permissions: normalizePermissions(data.permissions, role === "admin"),
    createdAt: data.createdAt?.toDate?.()?.toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString(),
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "userProfiles", uid));
  if (!snap.exists()) return null;
  return mapProfile(snap.id, snap.data());
}

export async function ensureCurrentUserProfile(): Promise<UserProfile | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const email = normalizeEmail(user.email ?? "");
  const existing = await getUserProfile(user.uid);
  if (existing) {
    if (email === BOOTSTRAP_ADMIN_EMAIL && (!existing.active || existing.role !== "admin")) {
      await updateDoc(doc(db, "userProfiles", user.uid), {
        role: "admin",
        active: true,
        permissions: createAdminPermissions(),
        updatedAt: serverTimestamp(),
      });
      return getUserProfile(user.uid);
    }
    return existing;
  }

  const pendingRef = email ? doc(db, "pendingUserAccess", email) : null;
  const pendingSnap = pendingRef ? await getDoc(pendingRef) : null;
  const pending = pendingSnap?.exists() ? pendingSnap.data() : null;

  const isBootstrapAdmin = email === BOOTSTRAP_ADMIN_EMAIL;
  const role: UserProfile["role"] = isBootstrapAdmin
    ? "admin"
    : pending?.role === "admin"
      ? "admin"
      : "user";
  const permissions = isBootstrapAdmin
    ? createAdminPermissions()
    : pending?.permissions
      ? normalizePermissions(pending.permissions, role === "admin")
      : createBasicUserPermissions();
  const active = isBootstrapAdmin ? true : pending?.active !== false;
  const name =
    isBootstrapAdmin
      ? user.displayName ?? ""
      : typeof pending?.name === "string" && pending.name
        ? pending.name
        : user.displayName ?? "";
  const cargo =
    isBootstrapAdmin
      ? "Administrador"
      : typeof pending?.cargo === "string"
        ? pending.cargo
        : role === "admin"
          ? "Administrador"
          : "";

  const profileData: Record<string, unknown> = {
    uid: user.uid,
    email,
    name,
    cargo,
    role,
    active,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (isBootstrapAdmin || pending) {
    profileData.permissions = permissions;
  }

  try {
    await setDoc(doc(db, "userProfiles", user.uid), profileData);
  } catch (error) {
    if (!isBootstrapAdmin) throw error;
    // O administrador de bootstrap continua com acesso mesmo antes de
    // o documento de perfil existir. O perfil poderá ser salvo depois.
    console.error("Não foi possível criar o perfil do administrador de bootstrap.", error);
    return {
      uid: user.uid,
      email,
      name,
      cargo: "Administrador",
      role: "admin",
      active: true,
      permissions: createAdminPermissions(),
    };
  }

  if (pendingRef && pendingSnap?.exists()) {
    await deleteDoc(pendingRef);
  }

  return getUserProfile(user.uid);
}

export async function assertCurrentAdmin(): Promise<UserProfile> {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");

  if (normalizeEmail(user.email ?? "") === BOOTSTRAP_ADMIN_EMAIL) {
    const existing = await getUserProfile(user.uid);
    if (existing?.role === "admin" && existing.active) return existing;
    return {
      uid: user.uid,
      email: user.email ?? BOOTSTRAP_ADMIN_EMAIL,
      name: existing?.name ?? user.displayName ?? "Administrador",
      photoUrl: existing?.photoUrl,
      cargo: existing?.cargo || "Administrador",
      role: "admin",
      active: true,
      permissions: createAdminPermissions(),
      createdAt: existing?.createdAt,
      updatedAt: existing?.updatedAt,
    };
  }

  const profile = await getUserProfile(user.uid);
  if (!profile || !profile.active || profile.role !== "admin") {
    throw new Error("Acesso administrativo não permitido.");
  }
  return profile;
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  await assertCurrentAdmin();
  const snapshot = await getDocs(
    query(collection(db, "userProfiles"), orderBy("email", "asc"))
  );
  return snapshot.docs.map((d) => mapProfile(d.id, d.data()));
}

export async function listPendingUserAccess(): Promise<PendingUserAccess[]> {
  await assertCurrentAdmin();
  const snapshot = await getDocs(
    query(collection(db, "pendingUserAccess"), orderBy("email", "asc"))
  );
  return snapshot.docs.map((d) => mapPendingAccess(d.id, d.data()));
}

async function findProfileByEmail(email: string): Promise<UserProfile | null> {
  const snapshot = await getDocs(collection(db, "userProfiles"));
  const normalized = normalizeEmail(email);
  const match = snapshot.docs.find(
    (item) => normalizeEmail(String(item.data().email ?? "")) === normalized
  );
  return match ? mapProfile(match.id, match.data()) : null;
}

export async function saveUserAccessConfiguration(input: {
  email: string;
  name: string;
  cargo: string;
  role: "admin" | "user";
  active: boolean;
  permissions: PermissionMap;
}): Promise<void> {
  await assertCurrentAdmin();
  const email = normalizeEmail(input.email);
  if (!email) throw new Error("Informe um e-mail válido.");

  const role = email === BOOTSTRAP_ADMIN_EMAIL ? "admin" : input.role;
  const active = email === BOOTSTRAP_ADMIN_EMAIL ? true : input.active;
  const permissions =
    role === "admin" ? createAdminPermissions() : input.permissions;

  const existing = await findProfileByEmail(email);
  if (existing) {
    await updateUserProfile(existing.uid, {
      name: input.name.trim(),
      cargo: input.cargo.trim(),
      role,
      active,
      permissions,
    });
    await deleteDoc(doc(db, "pendingUserAccess", email));
    return;
  }

  await setDoc(doc(db, "pendingUserAccess", email), {
    email,
    name: input.name.trim(),
    cargo: input.cargo.trim(),
    role,
    active,
    permissions,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePendingUserAccess(email: string): Promise<void> {
  await assertCurrentAdmin();
  await deleteDoc(doc(db, "pendingUserAccess", normalizeEmail(email)));
}

export async function updateUserProfile(
  uid: string,
  input: Pick<UserProfile, "name" | "cargo" | "role" | "active"> & {
    permissions: PermissionMap;
  }
): Promise<void> {
  await assertCurrentAdmin();

  const target = await getUserProfile(uid);
  if (!target) throw new Error("Perfil não encontrado.");

  const isBootstrap = normalizeEmail(target.email) === BOOTSTRAP_ADMIN_EMAIL;
  if (uid === auth.currentUser?.uid && input.active === false) {
    throw new Error("Você não pode desativar o próprio acesso.");
  }
  if (isBootstrap && (input.role !== "admin" || input.active === false)) {
    throw new Error("O acesso adm@adm.com deve permanecer como administrador ativo.");
  }

  await updateDoc(doc(db, "userProfiles", uid), {
    name: input.name,
    cargo: input.cargo,
    role: isBootstrap ? "admin" : input.role,
    active: isBootstrap ? true : input.active,
    permissions: isBootstrap
      ? createAdminPermissions()
      : input.role === "admin"
        ? createAdminPermissions()
        : input.permissions,
    updatedAt: serverTimestamp(),
  });
}

export async function updateOwnProfile(input: {
  name: string;
  cargo: string;
  photoUrl?: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");

  await updateDoc(doc(db, "userProfiles", user.uid), {
    name: input.name.trim(),
    cargo: input.cargo.trim(),
    ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
    updatedAt: serverTimestamp(),
  });
}

async function imageFileToDataUrl(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("A foto original precisa ter no máximo 8 MB.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      element.src = objectUrl;
    });

    const maxSize = 192;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a foto.");
    context.drawImage(image, 0, 0, width, height);

    let quality = 0.82;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= 180_000) return dataUrl;
      quality -= 0.1;
    }

    const reducedCanvas = document.createElement("canvas");
    const reducedScale = 144 / Math.max(width, height);
    reducedCanvas.width = Math.max(1, Math.round(width * reducedScale));
    reducedCanvas.height = Math.max(1, Math.round(height * reducedScale));
    const reducedContext = reducedCanvas.getContext("2d");
    if (!reducedContext) throw new Error("Não foi possível compactar a foto.");
    reducedContext.drawImage(image, 0, 0, reducedCanvas.width, reducedCanvas.height);
    const reducedDataUrl = reducedCanvas.toDataURL("image/jpeg", 0.7);
    if (reducedDataUrl.length > 180_000) {
      throw new Error("A foto não pôde ser compactada para um tamanho seguro.");
    }
    return reducedDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function uploadOwnProfilePhoto(file: File): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Usuário não autenticado.");
  return imageFileToDataUrl(file);
}

export async function removeUserProfile(uid: string): Promise<void> {
  await assertCurrentAdmin();
  const target = await getUserProfile(uid);
  if (!target) return;
  if (uid === auth.currentUser?.uid) {
    throw new Error("Você não pode excluir o próprio acesso administrativo.");
  }
  if (normalizeEmail(target.email) === BOOTSTRAP_ADMIN_EMAIL) {
    throw new Error("O perfil adm@adm.com não pode ser removido.");
  }
  await deleteDoc(doc(db, "userProfiles", uid));
}
