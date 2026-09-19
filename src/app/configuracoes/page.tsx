"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { signOut } from "@/lib/firebase/auth";

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await signOut();
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Configurações">
      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
        </CardHeader>
        <p className="mb-4 text-sm text-ink-muted">
          Preferências gerais do sistema serão adicionadas aqui conforme necessário.
        </p>
        <Button variant="danger" onClick={handleSignOut} loading={loading}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </Card>
    </AppShell>
  );
}
