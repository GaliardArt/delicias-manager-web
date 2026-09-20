"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import { useAuth } from "@/hooks/useAuth";

interface AppShellProps {
  title: string;
  children: React.ReactNode;
}

// Guarda de autenticação: toda página que usa AppShell exige login. Sem isso,
// abrir o app sem sessão (ou depois de deslogar) só mostrava telas quebradas
// em vez de mandar para /login.
export function AppShell({ title, children }: AppShellProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-8">
          <h1 className="mb-6 hidden font-display text-2xl font-semibold text-ink md:block">
            {title}
          </h1>
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
