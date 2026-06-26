"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignaturePad, type SignaturePadHandle } from "@/components/estagios/signature-pad";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Signature,
  Trash2,
  EyeOff,
  FileText,
  Eye,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { DatasAvaliacaoEditor } from "./datas-avaliacao-editor";
import { AvaliacaoPreviewDialog } from "./avaliacao-preview-dialog";
import { AvaliacaoFullscreenViewer } from "./avaliacao-fullscreen-viewer";
import { calculateNotaFinal } from "@/lib/avaliacao/validations";
import type {
  AvaliacaoConfig,
  NotasTutor,
  NotaFinalProfessor,
  CursoDatasAvaliacao,
} from "@/lib/avaliacao/types";

type Props = {
  estagioId: string;
  config: AvaliacaoConfig;
  tutorData: NotasTutor | null;
  professorData: NotaFinalProfessor | null;
  notaFinalCalculada: number | null;
  datas: CursoDatasAvaliacao | null;
  courseId?: string;
  isDirector: boolean;
};

export function ProfessorEvaluationView({
  estagioId,
  config,
  tutorData,
  professorData,
  notaFinalCalculada,
  datas,
  courseId,
  isDirector,
}: Props) {
  // Toggle: tutor view vs professor form
  const [tab, setTab] = useState<"tutor" | "professor">("tutor");

  // Professor form
  const [scores, setScores] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle | null>(null);

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<"tutor" | "nota-final">("tutor");
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const tutorSigned = tutorData?.estado === "assinado";
  const professorSigned = professorData?.estado === "assinado";

  // Init professor scores from existing data
  useEffect(() => {
    if (professorData?.parametros) {
      const initial: Record<string, string> = {};
      for (const param of config.parametros) {
        initial[param.nome] = String(professorData.parametros[param.nome] ?? "");
      }
      setScores(initial);
    } else {
      const empty: Record<string, string> = {};
      for (const param of config.parametros) {
        empty[param.nome] = "";
      }
      setScores(empty);
    }
  }, [professorData, config.parametros]);

  const updateScore = (nome: string, value: string) => {
    if (value !== "" && !/^\d+$/.test(value)) return;
    setScores((prev) => ({ ...prev, [nome]: value }));
  };

  const handleReset = async () => {
    setError(null);
    setResetting(true);
    try {
      const res = await fetch(`/api/estagios/${estagioId}/avaliacao/reset`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao repor avaliação.");
        return;
      }
      setSuccessMsg("Avaliação do tutor reposta. O tutor pode preencher novamente.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccessMsg(null);

    const numericScores: Record<string, number> = {};
    for (const param of config.parametros) {
      const val = parseInt(scores[param.nome] || "", 10);
      if (isNaN(val)) {
        setError(`Preencha um valor válido para "${param.nome}".`);
        return;
      }
      if (val < config.escala.min || val > config.escala.max) {
        setError(`"${param.nome}" deve estar entre ${config.escala.min} e ${config.escala.max}.`);
        return;
      }
      numericScores[param.nome] = val;
    }

    const signatureDataUrl = padRef.current?.toDataUrl();
    if (!signatureDataUrl) {
      try {
        const res = await fetch("/api/users/me/signature");
        const data = (await res.json()) as { exists?: boolean; data?: { dataUrl?: string } };
        if (!data.exists || !data.data?.dataUrl) {
          setError("Configure a sua assinatura no perfil ou desenhe uma abaixo.");
          return;
        }
      } catch {
        setError("Configure a sua assinatura no perfil ou desenhe uma abaixo.");
        return;
      }
    }

    setSubmitting(true);
    try {
      let sigDataUrl = signatureDataUrl;
      if (!sigDataUrl) {
        const res = await fetch("/api/users/me/signature");
        const data = (await res.json()) as { exists?: boolean; data?: { dataUrl?: string } };
        sigDataUrl = data.data?.dataUrl ?? "";
      }

      const res = await fetch(`/api/estagios/${estagioId}/avaliacao/professor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parametros: numericScores, signatureDataUrl: sigDataUrl }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao submeter avaliação.");
        return;
      }
      setSuccessMsg("Avaliação submetida e assinada com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  };

  const profNotaFinal = professorData?.notaFinal;

  return (
    <div className="space-y-6">
      {/* Date configuration — director only */}
      {isDirector && courseId && (
        <DatasAvaliacaoEditor courseId={courseId} isDirector={isDirector} />
      )}

      {/* Tab toggles */}
      <div className="flex gap-2">
        <Button
          variant={tab === "tutor" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("tutor")}
        >
          <Eye className="mr-2 h-4 w-4" />
          Avaliação do Tutor
        </Button>
        <Button
          variant={tab === "professor" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("professor")}
        >
          <EyeOff className="mr-2 h-4 w-4" />
          Minha Avaliação
        </Button>
      </div>

      {/* ── TUTOR VIEW ── */}
      {tab === "tutor" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Avaliação do Tutor</CardTitle>
            </CardHeader>
            <CardContent>
              {!tutorSigned ? (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>O tutor ainda não preencheu a avaliação.</span>
                </div>
              ) : tutorData ? (
                <div className="space-y-3">
          <div className="space-y-1">
                    {config.parametros.map((param) => (
                      <div key={param.nome} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{param.nome}</span>
                        <span className="font-medium">
                          {professorData?.parametros?.[param.nome] ?? "-"}
                          <span className="text-xs text-muted-foreground"> /{config.escala.max}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                    <span>Nota calculada ({config.metodoCalculo})</span>
                    <span>
                      {notaFinalCalculada !== null ? notaFinalCalculada : "-"}
                      {notaFinalCalculada !== null && (
                        <span className="text-xs font-normal text-muted-foreground"> /{config.notaFinalEsperada.max}</span>
                      )}
                    </span>
                  </div>
                  {tutorData.comentarios && (
                    <div className="border-t pt-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Comentários do tutor</p>
                      <p className="text-sm whitespace-pre-wrap">{tutorData.comentarios}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Assinado pelo tutor em{" "}
                    {tutorData.assinadoEm ? new Date(tutorData.assinadoEm).toLocaleString("pt-PT") : "—"}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* PDF buttons for tutor */}
          {tutorSigned && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documentos do Tutor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setPreviewType("tutor"); setPreviewOpen(true); }}>
                    <FileText className="mr-2 h-4 w-4" />
                    Pré-visualizar ficha do tutor
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── PROFESSOR VIEW ── */}
      {tab === "professor" && (
        <div className="space-y-4">
          {professorSigned && profNotaFinal !== undefined ? (
            <>
              <Card className="border-green-200 bg-green-50">
                <CardContent className="flex items-start gap-3 py-6">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800">Avaliação submetida</p>
                    <p className="text-sm text-green-700">
                      Nota final: {profNotaFinal} / {config.notaFinalEsperada.max}
                    </p>
                    {professorData?.assinadoEm && (
                      <p className="text-xs text-green-600">
                        Assinado em {new Date(professorData.assinadoEm).toLocaleString("pt-PT")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Parâmetros avaliados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {config.parametros.map((param) => (
                    <div key={param.nome} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{param.nome}</span>
                      <span className="font-medium">
                        {professorData?.parametros?.[param.nome] ?? "-"}
                        <span className="text-xs text-muted-foreground"> /{config.escala.max}</span>
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                    <span>Nota final ({config.metodoCalculo})</span>
                    <span>{profNotaFinal} / {config.notaFinalEsperada.max}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Documentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setPreviewType("nota-final"); setPreviewOpen(true); }}>
                      <FileText className="mr-2 h-4 w-4" />
                      Pré-visualizar nota final
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : tutorSigned ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Atribuir avaliação</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Atribua uma nota inteira entre {config.escala.min} e {config.escala.max} para cada parâmetro.
                    A nota final será calculada automaticamente.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {config.parametros.map((param) => (
                    <div key={param.nome} className="flex items-center gap-3">
                      <Label className="w-48 shrink-0 text-sm">{param.nome}</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={scores[param.nome] ?? ""}
                        onChange={(e) => updateScore(param.nome, e.target.value)}
                        className="w-20"
                        placeholder={`${config.escala.min}-${config.escala.max}`}
                      />
                      <span className="text-xs text-muted-foreground">/{config.escala.max}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assinatura</CardTitle>
                  <p className="text-sm text-muted-foreground">Desenhe a sua assinatura para finalizar.</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SignaturePad ref={padRef} width={440} height={160} />
                  <Button type="button" size="sm" variant="ghost" onClick={() => padRef.current?.clear()}>
                    <Trash2 className="mr-2 h-4 w-4" /> Limpar
                  </Button>
                </CardContent>
              </Card>

              <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A submeter...</>
                ) : (
                  <><Signature className="mr-2 h-4 w-4" /> Assinar avaliação</>
                )}
              </Button>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-start gap-2 py-6 text-sm text-muted-foreground">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Aguarde que o tutor preencha e assine a avaliação antes de atribuir a sua.</span>
              </CardContent>
            </Card>
          )}

          {/* Reset button */}
          {tutorSigned && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-destructive">Repor avaliação do tutor</CardTitle>
                <p className="text-sm text-muted-foreground">Desbloqueia o formulário para o tutor preencher novamente. Esta ação fica registada na auditoria.</p>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={handleReset} disabled={resetting}>
                  {resetting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> A repor...</> : <><RefreshCw className="mr-2 h-4 w-4" /> Repor avaliação</>}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Preview dialogs */}
      <AvaliacaoPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        estagioId={estagioId}
        pdfType={previewType}
        title={previewType === "tutor" ? "Ficha de Avaliação do Estágio" : "Nota Final do Estágio"}
        onOpenFullscreen={() => { setPreviewOpen(false); setFullscreenOpen(true); }}
      />
      <AvaliacaoFullscreenViewer
        open={fullscreenOpen}
        onClose={() => setFullscreenOpen(false)}
        estagioId={estagioId}
        pdfType={previewType}
        title={previewType === "tutor" ? "Ficha de Avaliação do Estágio" : "Nota Final do Estágio"}
      />
    </div>
  );
}
