"use client";

import { useRef, useState } from "react";
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
} from "lucide-react";
import { DatasAvaliacaoEditor } from "./datas-avaliacao-editor";
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
  const [notaFinal, setNotaFinal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const padRef = useRef<SignaturePadHandle | null>(null);

  const tutorSigned = tutorData?.estado === "assinado";
  const professorSigned = professorData?.estado === "assinado";

  const handleReset = async () => {
    setError(null);
    setResetting(true);
    try {
      const res = await fetch(
        `/api/estagios/${estagioId}/avaliacao/reset`,
        { method: "POST" }
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao repor avaliação.");
        return;
      }
      setSuccessMsg("Avaliação do tutor reposta com sucesso. O tutor pode agora preencher novamente.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado."
      );
    } finally {
      setResetting(false);
    }
  };

  const handleSubmitFinalGrade = async () => {
    setError(null);
    setSuccessMsg(null);

    const grade = parseInt(notaFinal, 10);
    if (isNaN(grade)) {
      setError("Insira um valor inteiro para a nota final.");
      return;
    }

    if (
      grade < config.notaFinalEsperada.min ||
      grade > config.notaFinalEsperada.max
    ) {
      setError(
        `A nota final deve estar entre ${config.notaFinalEsperada.min} e ${config.notaFinalEsperada.max}.`
      );
      return;
    }

    const signatureDataUrl = padRef.current?.toDataUrl();
    if (!signatureDataUrl) {
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
        `/api/estagios/${estagioId}/avaliacao/professor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notaFinal: grade,
            signatureDataUrl: sigDataUrl,
          }),
        }
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Falha ao submeter nota final.");
        return;
      }
      setSuccessMsg("Nota final atribuída e assinada com sucesso.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Date configuration — director only */}
      {isDirector && courseId && (
        <DatasAvaliacaoEditor
          courseId={courseId}
          isDirector={isDirector}
        />
      )}

      {/* Tutor evaluation display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Avaliação do Tutor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!tutorSigned ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                O tutor ainda não preencheu a avaliação. Será notificado quando
                estiver concluída.
              </span>
            </div>
          ) : tutorData ? (
            <div className="space-y-3">
              <div className="space-y-1">
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
              </div>
              <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                <span>
                  Nota calculada ({config.metodoCalculo})
                </span>
                <span>
                  {notaFinalCalculada !== null
                    ? notaFinalCalculada
                    : "-"}
                  {notaFinalCalculada !== null && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      /{config.notaFinalEsperada.max}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                Assinado pelo tutor em{" "}
                {tutorData.assinadoEm
                  ? new Date(tutorData.assinadoEm).toLocaleString("pt-PT")
                  : "—"}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Secret section: Final grade assignment */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            Atribuir Nota Final
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Secção restrita — invisível para tutores e alunos. Atribua a nota
            final do estágio dentro da escala{" "}
            {config.notaFinalEsperada.min}-{config.notaFinalEsperada.max}.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {professorSigned ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">
                    Nota final atribuída
                  </p>
                  <p className="text-sm text-green-700">
                    Nota: {professorData?.notaFinal} /{" "}
                    {config.notaFinalEsperada.max}
                  </p>
                  {professorData?.assinadoEm && (
                    <p className="text-xs text-green-600">
                      Assinado em{" "}
                      {new Date(
                        professorData.assinadoEm
                      ).toLocaleString("pt-PT")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : tutorSigned ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Label className="shrink-0">Nota final</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={notaFinal}
                  onChange={(e) => {
                    if (e.target.value !== "" && !/^\d+$/.test(e.target.value))
                      return;
                    setNotaFinal(e.target.value);
                  }}
                  className="w-24"
                  placeholder={`${config.notaFinalEsperada.min}-${config.notaFinalEsperada.max}`}
                />
                <span className="text-xs text-muted-foreground">
                  /{config.notaFinalEsperada.max}
                </span>
              </div>

              <div className="space-y-2">
                <Label>Assinatura</Label>
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
              </div>

              <Button
                onClick={handleSubmitFinalGrade}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A submeter...
                  </>
                ) : (
                  <>
                    <Signature className="mr-2 h-4 w-4" />
                    Assinar nota final
                  </>
                )}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aguarde que o tutor preencha e assine a avaliação antes de
              atribuir a nota final.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reset button */}
      {tutorSigned && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Repor avaliação do tutor
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Desbloqueia o formulário para o tutor preencher novamente. Esta
              ação fica registada no histórico.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A repor...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Repor avaliação
                </>
              )}
            </Button>
          </CardContent>
        </Card>
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
    </div>
  );
}
