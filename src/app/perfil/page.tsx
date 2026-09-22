"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Camera, Save, UserCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useUserProfile } from "@/hooks/useUserProfile";
import { uploadOwnProfilePhoto, updateOwnProfile } from "@/lib/firebase/users";

export default function PerfilPage() {
  const { profile, loading } = useUserProfile();
  const [name, setName] = useState("");
  const [cargo, setCargo] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setCargo(profile.cargo);
    setPhotoUrl(profile.photoUrl);
  }, [profile]);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null);
    setPhotoLoading(true);
    try {
      const dataUrl = await uploadOwnProfilePhoto(file);
      await updateOwnProfile({
        name: name.trim(),
        cargo: cargo.trim(),
        photoUrl: dataUrl,
      });
      setPhotoUrl(dataUrl);
      setMessage("Foto de perfil atualizada.");
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Não foi possível atualizar a foto.");
    } finally {
      setPhotoLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      await updateOwnProfile({ name: name.trim(), cargo: cargo.trim() });
      setMessage("Perfil salvo com sucesso.");
    } catch (err) {
      console.error(err);
      setMessage(err instanceof Error ? err.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !profile) return null;

  return (
    <AppShell title="Perfil">
      <div className="mx-auto grid max-w-3xl gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Foto de perfil</CardTitle>
          </CardHeader>
          <div className="flex flex-col items-center text-center">
            <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-babypink text-brand-600">
              {photoUrl ? (
                <img src={photoUrl} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                <UserCircle className="h-20 w-20" />
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photoLoading}
                className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-brand-500 text-white shadow-soft disabled:opacity-60"
                aria-label="Alterar foto"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <p className="mt-3 text-xs text-ink-muted">
              A imagem é compactada e salva diretamente no Firestore. O arquivo original pode ter até 8 MB.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados do perfil</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input id="profile-email" label="E-mail de login" value={profile.email} disabled />
            <Input
              id="profile-name"
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome exibido no sistema"
            />
            <Input
              id="profile-role"
              label="Cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex.: Proprietário, Vendedor, Produção"
            />
            <div className="rounded-xl bg-surface-muted p-3 text-sm text-ink-muted">
              <strong className="text-ink">Tipo de acesso:</strong>{" "}
              {profile.role === "admin" ? "Administrador" : "Usuário"}
            </div>
            {message && <p className="text-sm text-ink-muted">{message}</p>}
            <Button type="submit" loading={saving} className="w-full sm:w-auto sm:self-end">
              <Save className="h-4 w-4" /> Salvar perfil
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
