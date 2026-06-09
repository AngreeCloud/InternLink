"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, MapPin, Plus, Search, X, Users, GraduationCap } from "lucide-react";
import Link from "next/link";

type EmpresaItem = {
  id: string;
  nome: string;
  nif?: string;
  localidade?: string;
  distrito?: string;
  setor?: string;
  logoUrl?: string;
  ativa: boolean;
  tutorCount: number;
  estagioCount: number;
};

export function EmpresasPage({ basePath }: { basePath: string }) {
  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmpresas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/empresas");
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error || "Erro ao carregar empresas");
      }
      const data = (await res.json()) as { empresas?: EmpresaItem[] };
      setEmpresas(data.empresas ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
      setEmpresas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  const filtered = empresas.filter((e) => {
    if (statusFilter === "active" && !e.ativa) return false;
    if (statusFilter === "archived" && e.ativa) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.nome.toLowerCase().includes(q) ||
      (e.nif || "").toLowerCase().includes(q) ||
      (e.localidade || "").toLowerCase().includes(q) ||
      (e.setor || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Empresas</h1>
          <p className="text-muted-foreground">Base de dados de entidades de acolhimento</p>
        </div>
        <Button asChild>
          <Link href={`${basePath}/empresas/nova`}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Empresa
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Pesquisar empresas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {(["all", "active", "archived"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "Todas" : s === "active" ? "Ativas" : "Arquivadas"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">A carregar empresas...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ? "Nenhuma empresa encontrada." : "Nenhuma empresa registada. Cria a primeira empresa."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((empresa) => (
            <Link
              key={empresa.id}
              href={`${basePath}/empresas/${empresa.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                {empresa.logoUrl ? (
                  <img
                    src={empresa.logoUrl}
                    alt={empresa.nome}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{empresa.nome}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {empresa.setor ? `${empresa.setor}` : "Sem setor"}
                  {empresa.localidade ? ` · ${empresa.localidade}` : ""}
                  {empresa.distrito ? `, ${empresa.distrito}` : ""}
                </p>
                <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {empresa.estagioCount} estágio{empresa.estagioCount !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {empresa.tutorCount} tutor{empresa.tutorCount !== 1 ? "es" : ""}
                  </span>
                </div>
              </div>
              {empresa.localidade && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <MapPin className="h-3 w-3" />
                  {empresa.localidade}
                </span>
              )}
              {!empresa.ativa && (
                <span className="text-xs text-muted-foreground italic">Arquivada</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
