"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Trash2,
  Users,
  GraduationCap,
  Shield,
} from "lucide-react";

type EducandoEntry = { id: string; nome: string };

type EE = {
  uid: string;
  nome: string;
  email: string;
  estado: string;
  educandos: EducandoEntry[];
  educandosCount: number;
  createdAt: unknown;
};

type Settings = {
  eePageAccess: "admin_only" | "professors";
};

export function EEManager({ schoolId }: { schoolId: string }) {
  const [ees, setEes] = useState<EE[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<Settings>({ eePageAccess: "admin_only" });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/school-admin/encarregados");
        if (!res.ok) return;
        const json = (await res.json()) as { ok: boolean; ees: EE[] };
        if (!json.ok || cancelled) return;
        setEes(json.ees);
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Fetch school settings to get eePageAccess
    (async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { getDbRuntime } = await import("@/lib/firebase-runtime");
        const db = await getDbRuntime();
        const snap = await getDoc(doc(db, "schools", schoolId));
        if (!snap.exists() || cancelled) return;
        const data = snap.data() as Record<string, unknown>;
        if (data.eePageAccess) {
          setSettings({ eePageAccess: data.eePageAccess as "admin_only" | "professors" });
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [schoolId]);

  const filteredEes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ees;
    return ees.filter(
      (ee) =>
        ee.nome.toLowerCase().includes(q) ||
        ee.email.toLowerCase().includes(q) ||
        ee.educandos.some((e) => e.nome.toLowerCase().includes(q))
    );
  }, [ees, search]);

  const totalEducandos = useMemo(
    () => ees.reduce((sum, ee) => sum + ee.educandosCount, 0),
    [ees]
  );

  const handleDeleteEE = async (eeUid: string) => {
    if (!confirm("Eliminar este Encarregado de Educação? Esta ação é irreversível.")) return;
    try {
      const res = await fetch(`/api/encarregado/delete-ee`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eeUid }),
      });
      if (!res.ok) return;
      setEes((prev) => prev.filter((ee) => ee.uid !== eeUid));
    } catch { /* ignore */ }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await fetch("/api/school-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eePageAccess: settings.eePageAccess }),
      });
    } catch { /* ignore */ } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Encarregados de Educação</h1>
        <p className="text-muted-foreground">
          Gerir todos os Encarregados de Educação da escola.
        </p>
      </div>

      {/* Settings card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Definições de acesso
          </CardTitle>
          <CardDescription>
            Define quem pode aceder a esta página de gestão de Encarregados de Educação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Acesso:</label>
            <select
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
              value={settings.eePageAccess}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  eePageAccess: e.target.value as "admin_only" | "professors",
                }))
              }
            >
              <option value="admin_only">Apenas Admin Escolar</option>
              <option value="professors">Admin Escolar + Professores</option>
            </select>
            <Button size="sm" variant="outline" disabled={savingSettings} onClick={handleSaveSettings}>
              {savingSettings ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de EE</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ees.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Educandos</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalEducandos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por nome ou email do EE..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* EE list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-64" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {search ? "Nenhum EE encontrado." : "Nenhum Encarregado de Educação registado."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEes.map((ee) => (
            <Card key={ee.uid}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{ee.nome}</p>
                      <Badge variant={ee.estado === "ativo" ? "default" : "secondary"}>
                        {ee.estado}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{ee.email}</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">Educandos:</span>
                      {ee.educandos.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nenhum</span>
                      ) : (
                        ee.educandos.map((e) => (
                          <Badge key={e.id} variant="outline" className="text-xs">
                            {e.nome}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleDeleteEE(ee.uid)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
