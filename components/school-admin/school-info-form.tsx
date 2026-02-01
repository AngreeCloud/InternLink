"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { useSchoolAdmin } from "@/components/school-admin/school-admin-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  educationLevel: string;
  emailDomain: string;
  requireInstitutionalEmail: boolean;
};

export function SchoolInfoForm() {
  const { schoolId } = useSchoolAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SchoolInfo>({
    name: "",
    shortName: "",
    address: "",
    contact: "",
    educationLevel: "",
    emailDomain: "",
    requireInstitutionalEmail: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
          educationLevel: data.educationLevel || "",
          emailDomain: data.emailDomain || "",
          requireInstitutionalEmail: Boolean(data.requireInstitutionalEmail),
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

  const handleSubmit = async (event: React.FormEvent) => {
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
    const db = await getDbRuntime();

    await setDoc(
      doc(db, "schools", schoolId),
      {
        ...form,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setSaving(false);
    setSuccess("Informações atualizadas com sucesso.");
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
            <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              <input
                id="requireInstitutionalEmail"
                type="checkbox"
                checked={form.requireInstitutionalEmail}
                onChange={(event) => updateField("requireInstitutionalEmail", event.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="requireInstitutionalEmail">
                Exigir email institucional para associar à escola e cursos
              </Label>
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
