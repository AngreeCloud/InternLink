"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignaturePad, type SignaturePadHandle } from "@/components/estagios/signature-pad";
import {
  Loader2,
  Lock,
  AlertCircle,
  CheckCircle2,
  PenTool,
  Signature,
  Trash2,
  FileText,
} from "lucide-react";
import type {
  AvaliacaoConfig,
  NotasTutor,
  CursoDatasAvaliacao,
} from "@/lib/avaliacao/types";
import { calculateNotaFinal } from "@/lib/avaliacao/validations";
import { AvaliacaoPreviewDialog } from "./avaliacao-preview-dialog";
import { AvaliacaoFullscreenViewer } from "./avaliacao-fullscreen-viewer";

type Props = {
  estagioId: string;
  config: AvaliacaoConfig;
  tutorData: NotasTutor | null;
  datas: CursoDatasAvaliacao | null;
};

export function TutorEvaluationForm({
  estagioId,
  config,
  tutorData,
  datas,
}: Props) {
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comentarios, setComentarios] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const padRef = useRef<SignaturePadHandle | null>(null);

  // Check availability date
  const now = new Date();
  const disponibilidadeDate = datas?.datas?.disponibilidadePreenchimento
    ? new Date(datas.datas.disponibilidadePreenchimento)
    : null;
  const isBlocked = disponibilidadeDate ? now < disponibilidadeDate : false;
  const isSigned = tutorData?.estado === "assinado";

  useEffect(() => {
    if (tutorData?.parametros) {
      const initial: Record<string, string> = {};
      for (const param of config.parametros) {
        initial[param.nome] = String(tutorData.parametros[param.nome] ?? "");
      }
      setScores(initial);
      setComentarios(tutorData.comentarios ?? "");
    } else {
      const empty: Record<string, string> = {};
      for (const param of config.parametros) {
        empty[param.nome] = "";
      }
      setScores(empty);
    }
  }, [tutorData, config.parametros]);

  const notaFinalCalculada = tutorData?.parametros
    ? calculateNotaFinal(tutorData.parametros, config)
    : null;

  const handleSubmit = async () => {
    setError(null);

    // Build numeric scores
    const numericScores: Record<string, number> = {};
    for (const param of config.parametros) {
      const val = parseInt(scores[param.nome] || "", 10);
      if (isNaN(val)) {
        setError(`Preencha um valor válido para "${param.nome}".`);
        return;
      }
      if (val < config.escala.min || val > config.escala.max) {
        setError(
          `"${param.nome}" deve estar entre ${config.escala.min} e ${config.escala.max}.`
        );
        return;
      }
      numericScores[param.nome] = val;
    }

    // Check signature
    const signatureDataUrl = padRef.current?.toDataUrl();
    if (!signatureDataUrl) {
      // Try saved signature
      try {
        const res = await fetch("/api/users/me/signature");
        const data = (await res.json()) as {
          ok?: boolean;
          exists?: boolean;
          data?: { dataUrl?: string };
        };
        if (!data.exists || !data.data?.dataUrl) {
          setError(
            "Configure a sua assinatura no perfil ou desenhe uma abaixo."
          );
          return;
        }
      } catch {
        setError("Configure a sua assinatura no perfil ou desenhe uma abaixo.");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Use drawn signature or fetch saved one
      let sigDataUrl = signatureDataUrl;
      if (!sigDataUrl) {
        const res = await fetch("/api/users/me/signature");
        const data = (await res.json()) as {
          exists?: boolean;
          data?: { dataUrl?: string };
        };
        sigDataUrl = data.data?.dataUrl ?? "";
      }

      const res = await fetch(
        `/api/estagios/${estagioId}/avaliacao/tutor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parametros: numericScores,
            comentarios: comentarios.trim() || undefined,
            signatureDataUrl: sigDataUrl,
          }),
        }
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao submeter avaliação.");
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateScore = (nome: string, value: string) => {
    // Only allow integer input
    if (value !== "" && !/^\d+$/.test(value)) return;
    setScores((prev) => ({ ...prev, [nome]: value }));
  };

  // Blocked state
  if (isBlocked) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-3 text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-balance">
            Avaliação indisponível
          </h3>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">
            O preenchimento da avaliação estará disponível a partir de{" "}
            {disponibilidadeDate?.toLocaleDateString("pt-PT")}.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (success || isSigned) {
    return (
      <div className="space-y-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-start gap-3 py-6">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold text-green-800">
                Avaliação assinada com sucesso
              </p>
              <p className="text-sm text-green-700">
                A sua avaliação foi registada. O professor orientador será
                notificado.
              </p>
            </div>
          </CardContent>
        </Card>

        {tutorData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Resumo da sua avaliação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {config.parametros.map((param) => (
                <div
                  key={param.nome}
                  className="flex justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {param.nome}
                  </span>
                  <span className="font-medium">
                    {tutorData.parametros[param.nome] ?? "-"}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      /{config.escala.max}
                    </span>
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                <span>Nota calculada ({config.metodoCalculo})</span>
                <span>
                  {notaFinalCalculada !== null ? notaFinalCalculada : "-"}
                  {notaFinalCalculada !== null && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      /{config.notaFinalEsperada.max}
                    </span>
                  )}
                </span>
              </div>
              {tutorData.comentarios && (
                <div className="border-t pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Comentários</p>
                  <p className="text-sm whitespace-pre-wrap">{tutorData.comentarios}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documento</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Pré-visualizar avaliação
            </Button>
          </CardContent>
        </Card>

        <AvaliacaoPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          estagioId={estagioId}
          pdfType="tutor"
          title="Ficha de Avaliação do Estágio"
          onOpenFullscreen={() => {
            setPreviewOpen(false);
            setFullscreenOpen(true);
          }}
        />
        <AvaliacaoFullscreenViewer
          open={fullscreenOpen}
          onClose={() => setFullscreenOpen(false)}
          estagioId={estagioId}
          pdfType="tutor"
          title="Ficha de Avaliação do Estágio"
        />
      </div>
    );
  }

  // Form state
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Preencher avaliação do estagiário
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Atribua uma nota inteira entre {config.escala.min} e{" "}
            {config.escala.max} para cada parâmetro.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {config.parametros.map((param) => (
            <div
              key={param.nome}
              className="flex items-center gap-3"
            >
              <Label className="w-48 shrink-0 text-sm">
                {param.nome}
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                value={scores[param.nome] ?? ""}
                onChange={(e) =>
                  updateScore(param.nome, e.target.value)
                }
                className="w-20"
                placeholder={`${config.escala.min}-${config.escala.max}`}
              />
              <span className="text-xs text-muted-foreground">
                /{config.escala.max}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comentários (opcional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Comentários adicionais sobre o desempenho do estagiário..."
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinatura</CardTitle>
          <p className="text-sm text-muted-foreground">
            Desenhe a sua assinatura abaixo para finalizar a avaliação.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <SignaturePad ref={padRef} width={440} height={160} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => padRef.current?.clear()}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full"
        size="lg"
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            A submeter...
          </>
        ) : (
          <>
            <Signature className="mr-2 h-4 w-4" />
            Assinar avaliação
          </>
        )}
      </Button>
    </div>
  );
}
