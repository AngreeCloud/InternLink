"use client";

import { type FormEvent, useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EDUCATION_LEVELS = [
  "Secundária/Profissional",
  "Licenciatura",
  "Mestrado",
  "Doutoramento",
];

type SchoolInfo = {
  name: string;
  shortName: string;
  address: string;
  contact: string;
  bannerUrl: string;
  profileImageUrl: string;
  educationLevel: string;
  emailDomain: string;
  requireInstitutionalEmail: boolean;
  allowGoogleLogin: boolean;
  requiresPhone: boolean;
  requirePhone: boolean;
  requirePhoneVerification: boolean;
};

export function SchoolInfoForm() {
  const { schoolId } = useSchoolAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<SchoolInfo>({
    name: "",
    shortName: "",
    address: "",
    contact: "",
    bannerUrl: "",
    profileImageUrl: "",
    educationLevel: "",
    emailDomain: "",
    requireInstitutionalEmail: false,
    allowGoogleLogin: false,
    requiresPhone: false,
    requirePhone: false,
    requirePhoneVerification: false,
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const db = await getDbRuntime();
      const snap = await getDoc(doc(db, "schools", schoolId));

      if (!active) return;

      if (snap.exists()) {
        const data = snap.data() as Partial<SchoolInfo>;
        setForm({
          name: data.name || "",
          shortName: data.shortName || "",
          address: data.address || "",
          contact: data.contact || "",
          bannerUrl: data.bannerUrl || "",
          profileImageUrl: data.profileImageUrl || "",
          educationLevel: data.educationLevel || "",
          emailDomain: data.emailDomain || "",
          requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
          allowGoogleLogin: Boolean(data.allowGoogleLogin),
          // Backwards compatibility: prefer new flags if present
          requiresPhone: Boolean(data.requiresPhone),
          requirePhone: data.requirePhone !== undefined ? Boolean(data.requirePhone) : Boolean(data.requiresPhone),
          requirePhoneVerification:
            data.requirePhoneVerification !== undefined
              ? Boolean(data.requirePhoneVerification)
              : Boolean(data.requiresPhone),
        });
      }

      setLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [schoolId]);

  const updateField = (field: keyof SchoolInfo, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name.trim()) {
      setError("O nome completo da escola é obrigatório.");
      return;
    }

    if (!form.emailDomain.trim()) {
      setError("O domínio de email institucional é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      const db = await getDbRuntime();
      const requiresPhone = Boolean(form.requirePhone || form.requirePhoneVerification);
      const allowGoogleLogin = form.requireInstitutionalEmail ? false : form.allowGoogleLogin;

      await setDoc(
        doc(db, "schools", schoolId),
        {
          ...form,
          requiresPhone,
          allowGoogleLogin,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSuccess("Informações atualizadas com sucesso.");
    } catch (err) {
      console.error("Erro ao atualizar informações da escola:", err);
      setError("Não foi possível atualizar as informações da escola. Tente novamente mais tarde.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações da Escola</CardTitle>
        <CardDescription>Atualize os dados da sua escola.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">A carregar informações...</p>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Nome completo da escola"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Abreviatura</Label>
              <Input
                value={form.shortName}
                onChange={(event) => updateField("shortName", event.target.value)}
                placeholder="Sigla (opcional)"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                  placeholder="Endereço da escola"
                />
              </div>
              <div className="space-y-2">
                <Label>Contacto</Label>
                <Input
                  value={form.contact}
                  onChange={(event) => updateField("contact", event.target.value)}
                  placeholder="Contacto telefónico"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>URL da imagem da escola</Label>
                <Input
                  value={form.profileImageUrl}
                  onChange={(event) => updateField("profileImageUrl", event.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>URL do banner da escola</Label>
                <Input
                  value={form.bannerUrl}
                  onChange={(event) => updateField("bannerUrl", event.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            {(form.profileImageUrl || form.bannerUrl) && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Pré-visualização</p>
                {form.bannerUrl ? (
                  <div className="h-24 w-full overflow-hidden rounded-md bg-muted">
                    <img src={form.bannerUrl} alt="Banner da escola" className="h-full w-full object-cover" />
                  </div>
                ) : null}
                {form.profileImageUrl ? (
                  <img
                    src={form.profileImageUrl}
                    alt="Imagem da escola"
                    className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
                  />
                ) : null}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nível de ensino</Label>
                <Select value={form.educationLevel} onValueChange={(value) => updateField("educationLevel", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o nível" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDUCATION_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Domínio de email institucional</Label>
                <Input
                  value={form.emailDomain}
                  onChange={(event) => updateField("emailDomain", event.target.value)}
                  placeholder="@escola.pt"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <input
                  id="requireInstitutionalEmail"
                  type="checkbox"
                  checked={form.requireInstitutionalEmail}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      requireInstitutionalEmail: checked,
                      allowGoogleLogin: checked ? false : prev.allowGoogleLogin,
                    }));
                  }}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="requireInstitutionalEmail" className="cursor-pointer">
                  Exigir email institucional para registo
                </Label>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <input
                  id="allowGoogleLogin"
                  type="checkbox"
                  checked={form.allowGoogleLogin}
                  onChange={(event) => updateField("allowGoogleLogin", event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                  disabled={form.requireInstitutionalEmail}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="allowGoogleLogin"
                    className={form.requireInstitutionalEmail ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
                  >
                    Permitir login com Google
                  </Label>
                  {form.requireInstitutionalEmail && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Desativado automaticamente quando email institucional é obrigatório
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <input
                  id="requirePhone"
                  type="checkbox"
                  checked={form.requirePhone}
                  onChange={(event) => updateField("requirePhone", event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <div className="flex-1">
                  <Label htmlFor="requirePhone" className="cursor-pointer">
                    Tornar o número de telemóvel obrigatório no registo
                  </Label>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <input
                  id="requirePhoneVerification"
                  type="checkbox"
                  checked={form.requirePhoneVerification}
                  onChange={(event) => updateField("requirePhoneVerification", event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <div className="flex-1">
                  <Label htmlFor="requirePhoneVerification" className="cursor-pointer">
                    Exigir verificação por SMS após verificação de email
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Quando ativo, os utilizadores terão de confirmar o número via SMS depois do email.
                  </p>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-emerald-600">{success}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "A guardar..." : "Guardar alterações"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
