"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Save, Shield, X } from "lucide-react";

type GrantLevel = "read" | "write";

type UserEntry = {
  uid: string;
  nome: string;
  email: string;
  grant: GrantLevel | null;
};

type Props = {
  empresaId: string;
  currentGrants: Record<string, "read" | "write"> | null | undefined;
  onGrantsSaved: (grants: Record<string, "read" | "write">) => void;
};

export function EmpresaPermissions({ empresaId, currentGrants, onGrantsSaved }: Props) {
  const [professors, setProfessors] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/empresas/professors");
        if (!res.ok) throw new Error("Erro ao carregar professores");
        const data = await res.json();
        if (!cancelled) {
          const grantMap = currentGrants ?? {};
          const entries = (data.professors ?? []).map((u: { uid: string; nome: string; email: string }) => ({
            uid: u.uid,
            nome: u.nome || "Sem nome",
            email: u.email || "",
            grant: (grantMap[u.uid] as GrantLevel) ?? null,
          }));
          setProfessors(entries);
        }
      } catch {
        if (!cancelled) setError("Erro ao carregar professores");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentGrants]);

  const setGrant = (uid: string, level: GrantLevel | null) => {
    setProfessors((prev) =>
      prev.map((p) => (p.uid === uid ? { ...p, grant: level } : p))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const grants: Record<string, "read" | "write"> = {};
      for (const p of professors) {
        if (p.grant) grants[p.uid] = p.grant;
      }
      const res = await fetch(`/api/empresas/${empresaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresaGrants: grants }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erro ao guardar permissões");
      }
      setSuccess("Permissões guardadas com sucesso.");
      onGrantsSaved(grants);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return professors;
    return professors.filter(
      (p) => p.nome.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    );
  }, [professors, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Permissões por utilizador</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Define quais os professores que podem aceder a esta empresa e com que nível.
        O administrador escolar tem sempre acesso total.
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar professor por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-500/40 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {success}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ? "Nenhum professor encontrado." : "Nenhum professor registado na escola."}
        </p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.map((prof) => (
            <div
              key={prof.uid}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{prof.nome}</p>
                <p className="text-xs text-muted-foreground truncate">{prof.email}</p>
              </div>
              <select
                className="rounded-md border border-border bg-background px-2 py-1 text-sm ml-4 shrink-0"
                value={prof.grant ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setGrant(prof.uid, val === "" ? null : (val as GrantLevel));
                }}
              >
                <option value="">Sem acesso</option>
                <option value="read">Leitura</option>
                <option value="write">Escrita</option>
              </select>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Guardar Permissões
        </Button>
      </div>
    </div>
  );
}
