"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileDown, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";

type PreflightResult = {
  allSumariosArchived: boolean;
  totalSumarios: number;
  archivedCount: number;
  pastWeekCount: number;
  pendingWeeks: string[];
  alunoHasSignature: boolean;
  tutorHasSignature: boolean;
  canExportSigned: boolean;
  hasAnySumario: boolean;
};

type Props = {
  estagioId: string;
  currentUserRole: string;
  alunoId?: string;
  tutorId?: string;
};

export function SumariosExportPanel({ estagioId, currentUserRole, alunoId, tutorId }: Props) {
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<"signed" | "unsigned" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const normalizedRole = currentUserRole.toLowerCase();
  const currentUserIsAluno = normalizedRole === "aluno";
  const currentUserIsTutor = normalizedRole === "tutor";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/estagios/${estagioId}/sumarios/export/preflight`);
        const data = await res.json() as { ok?: boolean } & PreflightResult;
        if (!cancelled && data.ok) {
          setPreflight(data);
        }
      } catch (err) {
        console.error("[v0] export preflight", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [estagioId]);

  const handleDownload = async (mode: "signed" | "unsigned") => {
    setDownloading(mode);
    setError(null);
    try {
      const res = await fetch(`/api/estagios/${estagioId}/sumarios/export?mode=${mode}`);
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error || "Erro ao gerar PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Registo_Sumarios.${mode === "signed" ? "assinado" : "sem_assinaturas"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          A verificar requisitos...
        </CardContent>
      </Card>
    );
  }

  if (!preflight || !preflight.hasAnySumario) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileDown className="h-4 w-4" />
          Exportar Registo de Sumários
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Verificação de requisitos
        </p>

        <div className="space-y-2">
          <RequirementItem
            ok={preflight.allSumariosArchived}
            label={
              preflight.totalSumarios > 0
                ? `Todos os sumários validados pelo tutor (${preflight.archivedCount}/${preflight.totalSumarios})`
                : "Sumários das semanas decorridas validados pelo tutor"
            }
            detail={
              preflight.pendingWeeks.length > 0
                ? `${preflight.pendingWeeks.join(", ")} — O tutor deve validar cada sumário antes de exportar.`
                : undefined
            }
          />

          <RequirementItem
            ok={preflight.alunoHasSignature}
            label="Assinatura do aluno configurada"
            actionHref={!preflight.alunoHasSignature && currentUserIsAluno ? "/profile" : undefined}
            actionLabel={!preflight.alunoHasSignature && currentUserIsAluno ? "Configurar assinatura no perfil" : undefined}
          />

          <RequirementItem
            ok={preflight.tutorHasSignature}
            label="Assinatura do tutor configurada"
            actionHref={!preflight.tutorHasSignature && currentUserIsTutor ? "/profile" : undefined}
            actionLabel={!preflight.tutorHasSignature && currentUserIsTutor ? "Configurar assinatura no perfil" : undefined}
          />
        </div>

        <div className="border-t pt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={downloading !== null}
            onClick={() => handleDownload("unsigned")}
          >
            {downloading === "unsigned" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descarregar sem assinaturas
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!preflight.canExportSigned || downloading !== null}
            onClick={() => handleDownload("signed")}
          >
            {downloading === "signed" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-4 w-4" />
            )}
            Descarregar com assinaturas
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RequirementItem({
  ok,
  label,
  detail,
  actionHref,
  actionLabel,
}: {
  ok: boolean;
  label: string;
  detail?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      )}
      <div>
        <span className={ok ? "text-foreground" : "text-destructive"}>{label}</span>
        {detail && (
          <p className="mt-0.5 text-muted-foreground">{detail}</p>
        )}
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="mt-0.5 block text-primary underline underline-offset-2 hover:text-primary/80"
          >
            → {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
