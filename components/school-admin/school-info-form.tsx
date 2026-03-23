"use client";

import { type FormEvent, type MouseEvent, useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getDbRuntime, getStorageRuntime } from "@/lib/firebase-runtime";
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
  bannerFocusX: number;
  bannerFocusY: number;
  profileFocusX: number;
  profileFocusY: number;
  educationLevel: string;
  emailDomain: string;
  requireInstitutionalEmail: boolean;
  allowGoogleLogin: boolean;
  requiresPhone: boolean;
  requirePhone: boolean;
  requirePhoneVerification: boolean;
};

function normalizeSchoolDomain(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return "";
  return normalized.startsWith("@") ? normalized.slice(1) : normalized;
}

export function SchoolInfoForm() {
  const { schoolId } = useSchoolAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<SchoolInfo>({
    name: "",
    shortName: "",
    address: "",
    contact: "",
    bannerUrl: "",
    profileImageUrl: "",
    bannerFocusX: 50,
    bannerFocusY: 50,
    profileFocusX: 50,
    profileFocusY: 50,
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
          bannerFocusX: typeof data.bannerFocusX === "number" ? data.bannerFocusX : 50,
          bannerFocusY: typeof data.bannerFocusY === "number" ? data.bannerFocusY : 50,
          profileFocusX: typeof data.profileFocusX === "number" ? data.profileFocusX : 50,
          profileFocusY: typeof data.profileFocusY === "number" ? data.profileFocusY : 50,
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

  const updateField = (field: keyof SchoolInfo, value: string | boolean | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFocusClick = (
    event: MouseEvent<HTMLDivElement>,
    assetType: "profile" | "banner",
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    if (assetType === "banner") {
      setForm((prev) => ({ ...prev, bannerFocusX: x, bannerFocusY: y }));
    } else {
      setForm((prev) => ({ ...prev, profileFocusX: x, profileFocusY: y }));
    }
  };

  const uploadSchoolImage = async (file: File, assetType: "profile" | "banner") => {
    if (!file.type.startsWith("image/")) {
      setError("Apenas imagens são permitidas.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("A imagem não pode exceder 5MB.");
      return;
    }

    setError("");
    setSuccess("");

    if (assetType === "profile") {
      setUploadingProfile(true);
    } else {
      setUploadingBanner(true);
    }

    try {
      const storage = await getStorageRuntime();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const objectPath = `school-assets/${schoolId}/${assetType}-${Date.now()}-${safeName}`;
      const objectRef = ref(storage, objectPath);

      await uploadBytes(objectRef, file, {
        contentType: file.type,
        cacheControl: "public,max-age=3600",
      });

      const downloadUrl = await getDownloadURL(objectRef);
      if (assetType === "profile") {
        updateField("profileImageUrl", downloadUrl);
      } else {
        updateField("bannerUrl", downloadUrl);
      }

      setSuccess(assetType === "profile" ? "Imagem da escola carregada." : "Banner da escola carregado.");
    } catch (err) {
      console.error("Erro ao carregar imagem da escola:", err);
      setError("Não foi possível carregar a imagem. Tente novamente.");
    } finally {
      if (assetType === "profile") {
        setUploadingProfile(false);
      } else {
        setUploadingBanner(false);
      }
    }
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

    const normalizedDomain = normalizeSchoolDomain(form.emailDomain);
    if (!normalizedDomain.includes(".")) {
      setError("Introduza um domínio válido (ex.: esrpeixoto.edu.pt).");
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
          emailDomain: normalizedDomain,
          requiresPhone,
          allowGoogleLogin,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setForm((prev) => ({ ...prev, emailDomain: normalizedDomain }));

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
                <Label htmlFor="schoolProfileImage">Imagem da escola</Label>
                <Input
                  id="schoolProfileImage"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadSchoolImage(file, "profile");
                    }
                    event.target.value = "";
                  }}
                  disabled={uploadingProfile || uploadingBanner}
                />
                <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP até 5MB.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolBannerImage">Banner da escola</Label>
                <Input
                  id="schoolBannerImage"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadSchoolImage(file, "banner");
                    }
                    event.target.value = "";
                  }}
                  disabled={uploadingProfile || uploadingBanner}
                />
                <p className="text-xs text-muted-foreground">Use um formato horizontal para melhor resultado.</p>
              </div>
            </div>

            {(uploadingProfile || uploadingBanner) && (
              <p className="text-sm text-muted-foreground">
                {uploadingProfile ? "A carregar imagem da escola..." : "A carregar banner da escola..."}
              </p>
            )}

            {(form.profileImageUrl || form.bannerUrl) && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Pré-visualização — clique para ajustar o ponto de foco
                </p>
                {form.bannerUrl ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Banner</p>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Clique no banner para ajustar o ponto de foco"
                      className="relative h-48 w-full cursor-crosshair select-none overflow-hidden rounded-md bg-muted"
                      onClick={(e) => handleFocusClick(e, "banner")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
                      }}
                    >
                      <img
                        src={form.bannerUrl}
                        alt="Banner da escola"
                        className="pointer-events-none h-full w-full object-cover"
                        style={{ objectPosition: `${form.bannerFocusX}% ${form.bannerFocusY}%` }}
                      />
                      <div
                        className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/20"
                        style={{ left: `${form.bannerFocusX}%`, top: `${form.bannerFocusY}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Foco: {form.bannerFocusX}%&nbsp;×&nbsp;{form.bannerFocusY}%
                    </p>
                  </div>
                ) : null}
                {form.profileImageUrl ? (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Imagem de perfil</p>
                    <div className="flex items-center gap-3">
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Clique na imagem para ajustar o ponto de foco"
                        className="relative h-20 w-20 cursor-crosshair select-none overflow-hidden rounded-full bg-muted ring-1 ring-border"
                        onClick={(e) => handleFocusClick(e, "profile")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
                        }}
                      >
                        <img
                          src={form.profileImageUrl}
                          alt="Imagem da escola"
                          className="pointer-events-none h-full w-full object-cover"
                          style={{ objectPosition: `${form.profileFocusX}% ${form.profileFocusY}%` }}
                        />
                        <div
                          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/20"
                          style={{ left: `${form.profileFocusX}%`, top: `${form.profileFocusY}%` }}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Foco: {form.profileFocusX}%&nbsp;×&nbsp;{form.profileFocusY}%
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateField("profileImageUrl", "")}
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
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
                  placeholder="escola.pt"
                  required
                />
                <p className="text-xs text-muted-foreground">Pode inserir com ou sem @. O sistema guarda apenas o domínio.</p>
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
