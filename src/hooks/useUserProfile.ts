"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
  BOOTSTRAP_ADMIN_EMAIL,
  ensureCurrentUserProfile,
  getUserProfile,
  UserProfile,
} from "@/lib/firebase/users";
import { createAdminPermissions, PermissionAction, PermissionModule } from "@/lib/permissions";

export function useUserProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (authLoading) return;
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const result = await ensureCurrentUserProfile();
        if (!cancelled) setProfile(result);
      } catch (err) {
        console.error(err);
        // O administrador de bootstrap precisa conseguir abrir o painel mesmo
        // se o documento inicial de perfil ainda não tiver sido criado ou
        // se as Rules antigas ainda estiverem publicadas.
        if (user.email?.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
          if (!cancelled) {
            setProfile({
              uid: user.uid,
              email: BOOTSTRAP_ADMIN_EMAIL,
              name: user.displayName ?? "Administrador",
              cargo: "Administrador",
              role: "admin",
              active: true,
              permissions: createAdminPermissions(),
            });
          }
        } else {
          // O perfil pode existir mesmo quando uma consulta de bootstrap falha.
          try {
            const fallback = await getUserProfile(user.uid);
            if (!cancelled) setProfile(fallback);
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

  function can(module: PermissionModule, action: PermissionAction = "view") {
    if (!profile || !profile.active) return false;
    if (profile.role === "admin") return true;
    return profile.permissions[module]?.[action] === true;
  }

  return { profile, loading: authLoading || loading, can };
}
