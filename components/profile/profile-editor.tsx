"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuthRuntime, getDbRuntime } from "@/lib/firebase-runtime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Save, Camera } from "lucide-react";
import Link from "next/link";

type ProfileData = {
  nome: string;
  email: string;
  telefone: string;
  localidade: string;
  dataNascimento: string;
  photoURL: string;
  role: string;
};

export function ProfileEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    nome: "",
    email: "",
    telefone: "",
    localidade: "",
    dataNascimento: "",
    photoURL: "",
    role: "",
  });
  const [photoPreview, setPhotoPreview] = useState("");
  const router = useRouter();

  useEffect(() => {
    let unsubscribe = () => {};

    (async () => {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          setLoading(false);
          router.replace("/login");
          return;
        }

        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) {
          setLoading(false);
          router.replace("/login");
          return;
        }

        const data = userSnap.data() as {
          nome?: string;
          email?: string;
          telefone?: string;
          localidade?: string;
          dataNascimento?: string;
          photoURL?: string;
          role?: string;
        };

        setProfile({
          nome: data.nome || "",
          email: data.email || user.email || "",
          telefone: data.telefone || "",
          localidade: data.localidade || "",
          dataNascimento: data.dataNascimento || "",
          photoURL: data.photoURL || "",
          role: data.role || "",
        });
        setPhotoPreview(data.photoURL || "");
        setLoading(false);
      });
    })();

    return () => unsubscribe();
  }, [router]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor selecione uma imagem.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      setProfile((prev) => ({ ...prev, photoURL: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const auth = await getAuthRuntime();
      const db = await getDbRuntime();
      const user = auth.currentUser;
      if (!user) return;

      await updateDoc(doc(db, "users", user.uid), {
        nome: profile.nome,
        telefone: profile.telefone,
        localidade: profile.localidade,
        dataNascimento: profile.dataNascimento,
        photoURL: profile.photoURL,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao guardar perfil:", error);
      alert("Erro ao guardar as alterações.");
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "aluno": return "Aluno";
      case "professor": return "Professor";
      case "tutor": return "Tutor";
      case "admin_escolar": return "Administrador Escolar";
      default: return role;
    }
  };

  const getBackLink = () => {
    switch (profile.role) {
      case "aluno": return "/dashboard";
      case "professor": return "/professor";
      case "tutor": return "/tutor";
      case "admin_escolar": return "/school-admin";
      default: return "/login";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          A carregar perfil...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" className="w-fit">
        <Link href={getBackLink()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>
            Edite as suas informações pessoais. O email não pode ser alterado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Photo */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={photoPreview || "/placeholder.svg"} alt={profile.nome} />
                <AvatarFallback className="text-lg">{profile.nome.charAt(0)}</AvatarFallback>
              </Avatar>
              <label
                htmlFor="photo-upload"
                className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Camera className="h-3.5 w-3.5" />
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
            <div>
              <p className="text-sm font-medium">{profile.nome || "Utilizador"}</p>
              <p className="text-xs text-muted-foreground">{getRoleLabel(profile.role)}</p>
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="profileNome">Nome</Label>
            <Input
              id="profileNome"
              value={profile.nome}
              onChange={(e) => setProfile((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="O seu nome"
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="profileTelefone">Telefone (Opcional)</Label>
            <Input
              id="profileTelefone"
              value={profile.telefone}
              onChange={(e) => setProfile((prev) => ({ ...prev, telefone: e.target.value }))}
              placeholder="O seu contacto"
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="profileLocalidade">Localidade (Opcional)</Label>
            <Input
              id="profileLocalidade"
              value={profile.localidade}
              onChange={(e) => setProfile((prev) => ({ ...prev, localidade: e.target.value }))}
              placeholder="A sua localidade"
            />
          </div>

          {/* Date of birth */}
          <div className="space-y-2">
            <Label htmlFor="profileDob">Data de Nascimento</Label>
            <Input
              id="profileDob"
              type="date"
              value={profile.dataNascimento}
              onChange={(e) => setProfile((prev) => ({ ...prev, dataNascimento: e.target.value }))}
            />
          </div>

          {success && (
            <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Perfil atualizado com sucesso!
            </div>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "A guardar..." : "Guardar Alterações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
