"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Building2, Loader2, Trash2, UserPlus, Search, X, MessageSquare } from "lucide-react";
import Link from "next/link";

type EmpresaFull = {
  id: string;
  nome: string;
  nif?: string;
  setor?: string;
  website?: string;
  descricao?: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
  concelho?: string;
  distrito?: string;
  pais?: string;
  emailGeral?: string;
  telefone?: string;
  ativa: boolean;
};

type TutorItem = {
  id: string;
  nome?: string;
  email?: string;
  telefone?: string;
};

type Props = {
  empresaId: string;
  basePath: string;
};

function InfoTab({ empresa }: { empresa: EmpresaFull }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h2 className="text-lg font-semibold">Localização</h2>
          {empresa.morada && <p className="text-sm">{empresa.morada}</p>}
          {empresa.codigoPostal && <p className="text-sm">{empresa.codigoPostal}</p>}
          {empresa.localidade && <p className="text-sm">{empresa.localidade}</p>}
          <div className="flex gap-2 text-sm text-muted-foreground">
            {empresa.concelho && <span>{empresa.concelho}</span>}
            {empresa.distrito && <span>{empresa.distrito}</span>}
          </div>
          {empresa.pais && <p className="text-sm text-muted-foreground">{empresa.pais}</p>}
          {!empresa.morada && !empresa.localidade && (
            <p className="text-sm text-muted-foreground">Sem informação de localização.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h2 className="text-lg font-semibold">Contacto</h2>
          {empresa.emailGeral && (
            <p className="text-sm">
              <span className="text-muted-foreground">Email: </span>
              {empresa.emailGeral}
            </p>
          )}
          {empresa.telefone && (
            <p className="text-sm">
              <span className="text-muted-foreground">Telefone: </span>
              {empresa.telefone}
            </p>
          )}
          {empresa.website && (
            <p className="text-sm">
              <span className="text-muted-foreground">Website: </span>
              {empresa.website}
            </p>
          )}
          {empresa.nif && (
            <p className="text-sm">
              <span className="text-muted-foreground">NIF: </span>
              {empresa.nif}
            </p>
          )}
          {!empresa.emailGeral && !empresa.telefone && (
            <p className="text-sm text-muted-foreground">Sem informação de contacto.</p>
          )}
        </div>
      </div>

      {empresa.descricao && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-2">
          <h2 className="text-lg font-semibold">Sobre</h2>
          <p className="text-sm">{empresa.descricao}</p>
        </div>
      )}

      {!empresa.ativa && (
        <p className="text-sm text-muted-foreground italic">Empresa arquivada.</p>
      )}
    </div>
  );
}

function TutoresTab({
  empresaId,
  basePath,
}: {
  empresaId: string;
  basePath: string;
}) {
  const [tutores, setTutores] = useState<TutorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [associating, setAssociating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TutorItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTutores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/empresas/${empresaId}/tutores`);
      if (!res.ok) throw new Error("Erro ao carregar tutores");
      const data = (await res.json()) as { tutores?: TutorItem[] };
      setTutores(data.tutores ?? []);
    } catch {
      setError("Erro ao carregar tutores");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchTutores();
  }, [fetchTutores]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/empresas/search/tutores?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = (await res.json()) as { tutores?: TutorItem[] };
          setSearchResults(data.tutores ?? []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, empresaId]);

  const associateTutor = async (tutorId: string) => {
    setAssociating(true);
    try {
      const res = await fetch(`/api/empresas/${empresaId}/tutores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutorId }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error || "Erro ao associar tutor");
      }
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      await fetchTutores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setAssociating(false);
    }
  };

  const desassociateTutor = async (tutorId: string) => {
    if (!confirm("Tens a certeza que queres desassociar este tutor?")) return;
    try {
      const res = await fetch(`/api/empresas/${empresaId}/tutores/${tutorId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error || "Erro ao desassociar tutor");
      }
      await fetchTutores();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tutores associados</h2>
        <Button size="sm" onClick={() => setShowSearch(!showSearch)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Associar tutor
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {showSearch && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar tutor por nome ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
            <button
              type="button"
              onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {searching && (
            <p className="text-sm text-muted-foreground">A pesquisar...</p>
          )}

          {!searching && searchResults.length === 0 && searchQuery.trim() && (
            <p className="text-sm text-muted-foreground">Nenhum tutor encontrado.</p>
          )}

          {!searching && searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((tutor) => {
                const alreadyAssociated = tutores.some((t) => t.id === tutor.id);
                return (
                  <div
                    key={tutor.id}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{tutor.nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">{tutor.email}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={alreadyAssociated ? "ghost" : "default"}
                      disabled={alreadyAssociated || associating}
                      onClick={() => associateTutor(tutor.id)}
                    >
                      {alreadyAssociated ? "Associado" : "Associar"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tutores.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum tutor associado a esta empresa.</p>
      ) : (
        <div className="space-y-2">
          {tutores.map((tutor) => (
            <div
              key={tutor.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium shrink-0">
                  {(tutor.nome || "T")[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tutor.nome || "Tutor sem nome"}</p>
                  {tutor.email && (
                    <p className="text-xs text-muted-foreground truncate">{tutor.email}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`${basePath}/chat?userId=${tutor.id}`}>
                    <MessageSquare className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => desassociateTutor(tutor.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmpresasDetail({ empresaId, basePath }: Props) {
  const [empresa, setEmpresa] = useState<EmpresaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"info" | "tutores">("info");

  const fetchEmpresa = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/empresas/${empresaId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Empresa não encontrada");
        }
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error || "Erro ao carregar empresa");
      }
      const data = (await res.json()) as { empresa?: EmpresaFull };
      if (!data.empresa) throw new Error("Empresa não encontrada");
      setEmpresa(data.empresa);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchEmpresa();
  }, [fetchEmpresa]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !empresa) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${basePath}/empresas`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <p className="text-destructive">{error || "Empresa não encontrada."}</p>
      </div>
    );
  }

  const tabs = [
    { key: "info" as const, label: "Informações" },
    { key: "tutores" as const, label: "Tutores" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${basePath}/empresas`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{empresa.nome}</h1>
            {empresa.setor && <p className="text-sm text-muted-foreground">{empresa.setor}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab empresa={empresa} />}
      {tab === "tutores" && <TutoresTab empresaId={empresaId} basePath={basePath} />}
    </div>
  );
}
