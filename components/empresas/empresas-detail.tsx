"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
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

type Props = {
  empresaId: string;
  basePath: string;
};

export function EmpresasDetail({ empresaId, basePath }: Props) {
  const router = useRouter();
  const [empresa, setEmpresa] = useState<EmpresaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
