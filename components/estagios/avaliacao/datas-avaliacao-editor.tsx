"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { getDbRuntime } from "@/lib/firebase-runtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, AlertCircle, CheckCircle2 } from "lucide-react";
import type { CursoDatasAvaliacao } from "@/lib/avaliacao/types";

type Props = {
  courseId: string;
  isDirector: boolean;
};

export function DatasAvaliacaoEditor({ courseId, isDirector }: Props) {
  const [datas, setDatas] = useState<CursoDatasAvaliacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [disponibilidade, setDisponibilidade] = useState("");
  const [publicacao, setPublicacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await getDbRuntime();
        const snap = await getDoc(
          doc(db, "courses", courseId, "settings", "avaliacaoDatas")
        );
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data() as CursoDatasAvaliacao;
          setDatas(data);
          setDisponibilidade(
            data.datas?.disponibilidadePreenchimento
              ? toLocalDateInput(data.datas.disponibilidadePreenchimento)
              : ""
          );
          setPublicacao(
            data.datas?.publicacaoNotaFinal
              ? toLocalDateInput(data.datas.publicacaoNotaFinal)
              : ""
          );
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (!disponibilidade && !publicacao) {
      setError("Defina pelo menos uma data.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (disponibilidade) {
        body.disponibilidadePreenchimento = new Date(
          disponibilidade
        ).toISOString();
      }
      if (publicacao) {
        body.publicacaoNotaFinal = new Date(publicacao).toISOString();
      }

      const res = await fetch(
        `/api/courses/${courseId}/avaliacao-datas`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao guardar datas.");
        return;
      }
      setSuccess("Datas de avaliação guardadas com sucesso.");
      // Update local state
      setDatas((prev) => ({
        ...(prev ?? { cursoId: courseId, schoolId: "", datas: { disponibilidadePreenchimento: "", publicacaoNotaFinal: "" } }),
        datas: {
          disponibilidadePreenchimento: disponibilidade
            ? new Date(disponibilidade).toISOString()
            : prev?.datas?.disponibilidadePreenchimento ?? "",
          publicacaoNotaFinal: publicacao
            ? new Date(publicacao).toISOString()
            : prev?.datas?.publicacaoNotaFinal ?? "",
        },
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isDirector) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            A carregar datas de avaliação...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" />
          Datas de Avaliação do Curso
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Defina quando o tutor pode preencher a avaliação e quando a nota
          final é publicada para o aluno. Estas datas aplicam-se a todos os
          estágios deste curso.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm">
              Disponibilidade para preenchimento
            </Label>
            <Input
              type="date"
              value={disponibilidade}
              onChange={(e) => setDisponibilidade(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A partir desta data, o tutor pode preencher e assinar a
              avaliação.
            </p>
            {datas?.datas?.disponibilidadePreenchimento && (
              <p className="text-xs">
                Atual:{" "}
                {new Date(
                  datas.datas.disponibilidadePreenchimento
                ).toLocaleDateString("pt-PT")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm">
              Publicação da nota final
            </Label>
            <Input
              type="date"
              value={publicacao}
              onChange={(e) => setPublicacao(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A partir desta data, o aluno pode ver a nota final do
              estágio.
            </p>
            {datas?.datas?.publicacaoNotaFinal && (
              <p className="text-xs">
                Atual:{" "}
                {new Date(
                  datas.datas.publicacaoNotaFinal
                ).toLocaleDateString("pt-PT")}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              A guardar...
            </>
          ) : (
            "Guardar datas"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function toLocalDateInput(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toISOString().split("T")[0] ?? "";
  } catch {
    return "";
  }
}
