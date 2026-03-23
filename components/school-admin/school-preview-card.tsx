"use client";

import { type MouseEvent, useEffect, useRef, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getDbRuntime, getStorageRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Camera, CheckCircle2, Crosshair, Globe, ImageIcon, Lock, Mail, MapPin, Phone, ShieldCheck, Upload, XCircle } from "lucide-react";

type SchoolSnapshot = {
  name: string;
  shortName: string;
  address: string;
  contact: string;
  educationLevel: string;
  emailDomain: string;
  requireInstitutionalEmail: boolean;
  allowGoogleLogin: boolean;
  requirePhone: boolean;
  requirePhoneVerification: boolean;
  bannerUrl: string;
  profileImageUrl: string;
  bannerFocusX: number;
  bannerFocusY: number;
  profileFocusX: number;
  profileFocusY: number;
};

export function SchoolPreviewCard() {
  const { schoolId } = useSchoolAdmin();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [focusMode, setFocusMode] = useState<"banner" | "profile" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [school, setSchool] = useState<SchoolSnapshot>({
    name: "",
    shortName: "",
    address: "",
    contact: "",
    educationLevel: "",
    emailDomain: "",
    requireInstitutionalEmail: false,
    allowGoogleLogin: false,
    requirePhone: false,
    requirePhoneVerification: false,
    bannerUrl: "",
    profileImageUrl: "",
    bannerFocusX: 50,
    bannerFocusY: 50,
    profileFocusX: 50,
    profileFocusY: 50,
  });

  const profileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const db = await getDbRuntime();
        const snap = await getDoc(doc(db, "schools", schoolId));
        if (!active) return;
        if (snap.exists()) {
          const d = snap.data() as Partial<SchoolSnapshot> & { requiresPhone?: boolean };
          setSchool({
            name: d.name || "",
            shortName: d.shortName || "",
            address: d.address || "",
            contact: d.contact || "",
            educationLevel: d.educationLevel || "",
            emailDomain: d.emailDomain || "",
            requireInstitutionalEmail: Boolean(d.requireInstitutionalEmail),
            allowGoogleLogin: Boolean(d.allowGoogleLogin),
            requirePhone: d.requirePhone !== undefined ? Boolean(d.requirePhone) : Boolean(d.requiresPhone),
            requirePhoneVerification: d.requirePhoneVerification !== undefined ? Boolean(d.requirePhoneVerification) : Boolean(d.requiresPhone),
            bannerUrl: d.bannerUrl || "",
            profileImageUrl: d.profileImageUrl || "",
            bannerFocusX: typeof d.bannerFocusX === "number" ? d.bannerFocusX : 50,
            bannerFocusY: typeof d.bannerFocusY === "number" ? d.bannerFocusY : 50,
            profileFocusX: typeof d.profileFocusX === "number" ? d.profileFocusX : 50,
            profileFocusY: typeof d.profileFocusY === "number" ? d.profileFocusY : 50,
          });
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [schoolId]);

  /* ── upload helper ─────────────────────────────────────────── */
  const uploadImage = async (file: File, assetType: "profile" | "banner") => {
    if (!file.type.startsWith("image/")) { setError("Apenas imagens são permitidas."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("A imagem não pode exceder 5 MB."); return; }
    setError(""); setSuccess("");
    assetType === "profile" ? setUploadingProfile(true) : setUploadingBanner(true);
    try {
      const storage = await getStorageRuntime();
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const objectRef = ref(storage, `school-assets/${schoolId}/${assetType}-${Date.now()}-${safeName}`);
      await uploadBytes(objectRef, file, { contentType: file.type, cacheControl: "public,max-age=3600" });
      const url = await getDownloadURL(objectRef);
      setSchool((prev) => assetType === "profile" ? { ...prev, profileImageUrl: url } : { ...prev, bannerUrl: url });
      setSuccess(assetType === "profile" ? "Imagem carregada." : "Banner carregado.");
    } catch {
      setError("Erro ao carregar imagem. Tente novamente.");
    } finally {
      assetType === "profile" ? setUploadingProfile(false) : setUploadingBanner(false);
    }
  };

  /* ── focus click ───────────────────────────────────────────── */
  const handleFocusClick = (event: MouseEvent<HTMLDivElement>, assetType: "banner" | "profile") => {
    if (focusMode !== assetType) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    setSchool((prev) =>
      assetType === "banner"
        ? { ...prev, bannerFocusX: x, bannerFocusY: y }
        : { ...prev, profileFocusX: x, profileFocusY: y }
    );
    setFocusMode(null);
  };

  /* ── persist focus + images ────────────────────────────────── */
  const saveImages = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const db = await getDbRuntime();
      await setDoc(
        doc(db, "schools", schoolId),
        {
          bannerUrl: school.bannerUrl,
          profileImageUrl: school.profileImageUrl,
          bannerFocusX: school.bannerFocusX,
          bannerFocusY: school.bannerFocusY,
          profileFocusX: school.profileFocusX,
          profileFocusY: school.profileFocusY,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSuccess("Imagens guardadas.");
    } catch {
      setError("Não foi possível guardar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const schoolLabel = school.shortName || school.name || "Escola";
  const anyUploading = uploadingProfile || uploadingBanner;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">A carregar pré-visualização...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Pré-visualização da Escola
        </CardTitle>
        <CardDescription>
          Assim é como a sua escola aparece para tutores e alunos. Clique nas imagens para substituir, ou ative o
          modo de foco para reposicionar o recorte.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── card mockup ── */}
        <div className="overflow-hidden rounded-xl border border-border shadow-sm">

          {/* Banner */}
          <div
            role={focusMode === "banner" ? "button" : undefined}
            tabIndex={focusMode === "banner" ? 0 : undefined}
            aria-label={focusMode === "banner" ? "Clique para definir o ponto de foco do banner" : undefined}
            className={[
              "relative h-44 w-full bg-muted",
              focusMode === "banner" ? "cursor-crosshair" : "",
            ].join(" ")}
            onClick={(e) => handleFocusClick(e, "banner")}
            onKeyDown={(e) => { if (focusMode === "banner" && (e.key === "Enter" || e.key === " ")) e.currentTarget.click(); }}
          >
            {school.bannerUrl ? (
              <img
                src={school.bannerUrl}
                alt="Banner da escola"
                className="pointer-events-none h-full w-full object-cover"
                style={{ objectPosition: `${school.bannerFocusX}% ${school.bannerFocusY}%` }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}

            {/* Focus crosshair */}
            {school.bannerUrl && focusMode !== "banner" && (
              <div
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white opacity-60 shadow ring-1 ring-black/20"
                style={{ left: `${school.bannerFocusX}%`, top: `${school.bannerFocusY}%` }}
              />
            )}

            {/* Banner overlay buttons */}
            {focusMode !== "banner" && (
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  type="button"
                  title="Substituir banner"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={anyUploading}
                >
                  {uploadingBanner ? (
                    <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                </button>
                {school.bannerUrl && (
                  <button
                    type="button"
                    title="Ajustar foco do banner"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
                    onClick={() => setFocusMode("banner")}
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {focusMode === "banner" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-medium text-white">
                Clique para definir o ponto de foco
                <button
                  type="button"
                  className="ml-3 rounded bg-white/20 px-2 py-1 text-xs hover:bg-white/30"
                  onClick={(e) => { e.stopPropagation(); setFocusMode(null); }}
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Profile row */}
          <div className="relative px-4 pb-4">
            <div className="flex items-end gap-3 -mt-8">

              {/* Profile image */}
              <div
                role={focusMode === "profile" ? "button" : undefined}
                tabIndex={focusMode === "profile" ? 0 : undefined}
                aria-label={focusMode === "profile" ? "Clique para definir o ponto de foco" : undefined}
                className={[
                  "relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-4 border-background bg-muted shadow",
                  focusMode === "profile" ? "cursor-crosshair" : "",
                ].join(" ")}
                onClick={(e) => handleFocusClick(e, "profile")}
                onKeyDown={(e) => { if (focusMode === "profile" && (e.key === "Enter" || e.key === " ")) e.currentTarget.click(); }}
              >
                {school.profileImageUrl ? (
                  <img
                    src={school.profileImageUrl}
                    alt="Imagem da escola"
                    className="pointer-events-none h-full w-full object-cover"
                    style={{ objectPosition: `${school.profileFocusX}% ${school.profileFocusY}%` }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}

                {/* Focus dot */}
                {school.profileImageUrl && focusMode !== "profile" && (
                  <div
                    className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white opacity-60 shadow ring-1 ring-black/20"
                    style={{ left: `${school.profileFocusX}%`, top: `${school.profileFocusY}%` }}
                  />
                )}

                {/* Upload + focus buttons (shown when not in focus mode) */}
                {focusMode !== "profile" && (
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 opacity-0 transition-opacity hover:bg-black/30 hover:opacity-100 rounded-full">
                    <button
                      type="button"
                      title="Substituir imagem de perfil"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                      onClick={() => profileInputRef.current?.click()}
                      disabled={anyUploading}
                    >
                      {uploadingProfile ? (
                        <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                      ) : (
                        <Camera className="h-3 w-3" />
                      )}
                    </button>
                    {school.profileImageUrl && (
                      <button
                        type="button"
                        title="Ajustar foco"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                        onClick={() => setFocusMode("profile")}
                      >
                        <Crosshair className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}

                {focusMode === "profile" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full text-white text-xs font-medium">
                    Clique
                  </div>
                )}
              </div>

              <div className="flex-1 pb-1 pt-10 min-w-0">
                <p className="text-base font-semibold leading-tight truncate">
                  {school.name || <span className="text-muted-foreground italic">Nome da escola</span>}
                </p>
                {school.shortName && (
                  <p className="text-xs text-muted-foreground">{school.shortName}</p>
                )}
              </div>
            </div>

            {/* Info chips */}
            {/* Info chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {school.educationLevel && (
                <Badge variant="secondary">{school.educationLevel}</Badge>
              )}
              {school.emailDomain && (
                <Badge variant="outline" className="font-mono text-xs">{school.emailDomain}</Badge>
              )}
            </div>

            {focusMode === "profile" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Clique na imagem de perfil para definir o ponto de foco. &nbsp;
                <button type="button" className="underline" onClick={() => setFocusMode(null)}>Cancelar</button>
              </p>
            )}

            {/* ── Extra info section ── */}
            <div className="mt-4 border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalhes</p>
              <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
                {school.emailDomain && (
                  <div className="flex items-start gap-2">
                    <Globe className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Domínio de email</dt>
                      <dd className="text-sm font-medium">{school.emailDomain}</dd>
                    </div>
                  </div>
                )}
                {school.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Endereço</dt>
                      <dd className="text-sm font-medium">{school.address}</dd>
                    </div>
                  </div>
                )}
                {school.contact && (
                  <div className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Contacto</dt>
                      <dd className="text-sm font-medium">{school.contact}</dd>
                    </div>
                  </div>
                )}
                {school.educationLevel && (
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Nível de ensino</dt>
                      <dd className="text-sm font-medium">{school.educationLevel}</dd>
                    </div>
                  </div>
                )}
              </dl>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                <span className="flex items-center gap-1.5 text-xs">
                  {school.requireInstitutionalEmail
                    ? <Lock className="h-3.5 w-3.5 text-amber-500" />
                    : <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className={school.requireInstitutionalEmail ? "font-medium" : "text-muted-foreground"}>
                    {school.requireInstitutionalEmail ? "Email institucional obrigatório" : "Email institucional não obrigatório"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  {school.allowGoogleLogin
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className={school.allowGoogleLogin ? "font-medium" : "text-muted-foreground"}>
                    {school.allowGoogleLogin ? "Login com Google permitido" : "Login com Google desativado"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  {school.requirePhone
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className={school.requirePhone ? "font-medium" : "text-muted-foreground"}>
                    {school.requirePhone ? "Telemóvel obrigatório" : "Telemóvel opcional"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  {school.requirePhoneVerification
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className={school.requirePhoneVerification ? "font-medium" : "text-muted-foreground"}>
                    {school.requirePhoneVerification ? "Verificação SMS ativa" : "Verificação SMS inativa"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── hidden file inputs ── */}
        <input
          ref={profileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadImage(f, "profile");
            e.target.value = "";
          }}
        />
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadImage(f, "banner");
            e.target.value = "";
          }}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-emerald-600">{success}</p>}

        {/* ── action bar ── */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button type="button" size="sm" variant="outline" onClick={() => bannerInputRef.current?.click()} disabled={anyUploading}>
            <Upload className="mr-2 h-3.5 w-3.5" />
            {uploadingBanner ? "A carregar banner..." : "Substituir banner"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => profileInputRef.current?.click()} disabled={anyUploading}>
            <Camera className="mr-2 h-3.5 w-3.5" />
            {uploadingProfile ? "A carregar imagem..." : "Substituir imagem"}
          </Button>
          <Button type="button" size="sm" onClick={saveImages} disabled={saving || anyUploading}>
            {saving ? "A guardar..." : "Guardar imagens"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
