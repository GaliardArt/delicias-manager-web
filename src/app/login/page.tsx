"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { signIn, syncCurrentUserDisplayName } from "@/lib/firebase/auth";
import { ensureCurrentUserProfile } from "@/lib/firebase/users";
import { POST_LOGIN_WELCOME_KEY } from "@/components/layout/PostLoginWelcome";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginSubmitRef = useRef(false);

  // Usuário que já estava autenticado deve ser redirecionado normalmente.
  // Durante um login iniciado pelo botão "Entrar", aguardamos o fluxo terminar
  // para não chegar ao dashboard antes de gravar a mensagem de boas-vindas.
  useEffect(() => {
    if (!authLoading && user && !loginSubmitRef.current) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    loginSubmitRef.current = true;

    try {
      const signedInUser = await signIn(email, password);
      let name =
        signedInUser.displayName?.trim() ||
        email.split("@")[0]?.trim() ||
        "usuário";

      try {
        const profile = await ensureCurrentUserProfile();
        if (profile?.name?.trim()) {
          name = profile.name.trim();
        }
      } catch (profileError) {
        console.error(profileError);
      }

      try {
        await syncCurrentUserDisplayName(name);
      } catch (authProfileError) {
        console.error(authProfileError);
      }

      try {
        sessionStorage.setItem(POST_LOGIN_WELCOME_KEY, name);
      } catch (storageError) {
        console.error(storageError);
      }

      router.replace("/dashboard");
    } catch (err) {
      console.error(err);
      loginSubmitRef.current = false;
      setError("E-mail ou senha incorretos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="text-3xl">🍰</span>
          <h1 className="font-display text-xl font-semibold text-ink">Joci Molina - Delicias Artesanais</h1>
          <p className="text-sm text-ink-muted">Entre para gerenciar suas vendas e encomendas</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <Input
            id="email"
            type="email"
            label="E-mail"
            placeholder="voce@delicias.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="password"
            type="password"
            label="Senha"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
