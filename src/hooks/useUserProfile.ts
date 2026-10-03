"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  getCurrentUserProfileCached,
  getUserProfile,
  UserProfile,
} from "@/lib/firebase/users";
import { createAdminPermissions, PermissionAction, PermissionModule } from "@/lib/permissions";

function getProfileCacheKey(uid: string): string {
  return `delicias-manager:user-profile:${uid}`;
}

function readCachedProfile(uid: string): UserProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(getProfileCacheKey(uid));
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(
      getProfileCacheKey(profile.uid),
      JSON.stringify(profile)
    );
  } catch (error) {
    console.error("Não foi possível armazenar o perfil em cache.", error);
  }
}

function removeCachedProfile(uid: string): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.removeItem(getProfileCacheKey(uid));
  } catch (error) {
    console.error("Não foi possível limpar o perfil em cache.", error);
  }
}

export function useUserProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(() =>
    user ? readCachedProfile(user.uid) : null
  );
  const [loading, setLoading] = useState(() => !user);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const cachedProfile = readCachedProfile(user.uid);
      if (cachedProfile && !cancelled) {
        setProfile(cachedProfile);
      }

      setLoading(!cachedProfile);

      try {
        const result = await getCurrentUserProfileCached();
        if (!cancelled) {
          setProfile(result);
          if (result) writeCachedProfile(result);
        }
      } catch (err) {
        console.error(err);
        // O administrador de bootstrap precisa conseguir abrir o painel mesmo
        // se o documento inicial de perfil ainda não tiver sido criado ou
        // se as Rules antigas ainda estiverem publicadas.
        if (user.email?.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
          const bootstrapProfile: UserProfile = {
            uid: user.uid,
            email: BOOTSTRAP_ADMIN_EMAIL,
            name: user.displayName ?? "Administrador",
            cargo: "Administrador",
            role: "admin",
            active: true,
            permissions: createAdminPermissions(),
          };

          if (!cancelled) {
            setProfile(bootstrapProfile);
            writeCachedProfile(bootstrapProfile);
          }
        } else {
          // O perfil pode existir mesmo quando uma consulta de bootstrap falha.
          try {
            const fallback = await getUserProfile(user.uid);
            if (!cancelled) {
              setProfile(fallback);
              if (fallback) writeCachedProfile(fallback);
            }
          } catch (fallbackError) {
            console.error(fallbackError);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!user) return;
    return () => {
      // O cache permanece entre trocas de rota e é removido apenas quando
      // não existe mais uma sessão autenticada.
    };
  }, [user]);

  function can(module: PermissionModule, action: PermissionAction = "view") {
    if (!profile || !profile.active) return false;
    if (profile.role === "admin") return true;
    return profile.permissions[module]?.[action] === true;
  }

  return { profile, loading: authLoading || loading, can };
}

export { getProfileCacheKey, readCachedProfile, writeCachedProfile, removeCachedProfile };
